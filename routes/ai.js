const express = require("express");
const router = express.Router();
const aiService = require("../services/aiService");
const { validateBody, validateId } = require("../middleware/validator");
const prisma = require("../config/prisma");
const Order = require("../models/Order");
const catchAsync = require("../utils/catchAsync");

router.post("/describe-menu", validateBody(["name"]), catchAsync(async (req, res) => {
    const { name, category, price, description } = req.body;
    const aiDescription = await aiService.generateMenuDescription({
        name, category, price, description
    });
    res.json({ description: aiDescription });
}));

router.post("/recommend", validateId(["store_id"]), catchAsync(async (req, res) => {
    const { store_id, preferences, weather, mood, phone, toss_user_key } = req.body;
    const time = new Date().toLocaleTimeString("ko-KR");

    let pastOrders = [];
    if (phone || toss_user_key) {
        const history = await Order.findByCustomer(phone, toss_user_key);
        pastOrders = history
            .flatMap(order => order.items.map(item => item.product_name))
            .slice(0, 10);
    }

    const menuList = await prisma.products.findMany({
        where: {
            store_id: parseInt(store_id),
            is_active: true,
            is_sold_out: false
        },
        select: {
            id: true,
            name: true,
            price: true,
            categories: { select: { name: true } }
        }
    });

    if (menuList.length === 0) {
        return res.json({ recommendations: [] });
    }

    const recommendations = await aiService.recommendMenus(
        { preferences, time, weather, mood, pastOrders },
        menuList
    );

    const enrichedRecommendations = recommendations.map(rec => {
        const menu = menuList.find(m => m.id === rec.id);
        if (!menu) return null;
        return {
            ...menu,
            recommend_reason: rec.reason
        };
    }).filter(Boolean);

    res.json({ recommendations: enrichedRecommendations });
}));

router.post("/recommend-dessert", validateId(["store_id"]), catchAsync(async (req, res) => {
    const { store_id, currentItems } = req.body;

    if (!currentItems || !Array.isArray(currentItems) || currentItems.length === 0) {
        return res.json({ recommendations: [] });
    }

    const dessertList = await prisma.products.findMany({
        where: {
            store_id: parseInt(store_id),
            is_active: true,
            is_sold_out: false,
            categories: {
                name: {
                    in: ["디저트", "Dessert", "후식", "사이드", "음료", "Coffee", "커피"]
                }
            }
        },
        select: {
            id: true,
            name: true,
            price: true
        }
    });

    if (dessertList.length === 0) {
        return res.json({ recommendations: [] });
    }

    const recommendations = await aiService.recommendDesserts(currentItems, dessertList);

    const enrichedRecommendations = recommendations.map(rec => {
        const menu = dessertList.find(d => d.id === rec.id);
        if (!menu) return null;
        return {
            ...menu,
            recommend_reason: rec.reason
        };
    }).filter(Boolean);

    res.json({ recommendations: enrichedRecommendations });
}));

router.post("/translate-menu", validateBody(["store_id", "targetLang"]), catchAsync(async (req, res) => {
    const { store_id, targetLang } = req.body;

    const menuList = await prisma.products.findMany({
        where: {
            store_id: parseInt(store_id),
            is_active: true
        },
        select: {
            id: true,
            name: true,
            description: true
        }
    });

    if (menuList.length === 0) {
        return res.json({ success: true, translations: [] });
    }

    const translations = await aiService.batchTranslateMenus(menuList, targetLang);

    res.json({
        success: true,
        targetLang,
        translations
    });
}));

router.post("/translate", validateBody(["text", "targetLang"]), catchAsync(async (req, res) => {
    const { text, targetLang } = req.body;
    const translated = await aiService.translateText(text, targetLang);
    res.json({ success: true, translated });
}));

router.post("/storytelling", validateBody(["name"]), catchAsync(async (req, res) => {
    const { name, category, description, targetLang } = req.body;
    const story = await aiService.generateMenuStory({
        name,
        category,
        description,
        targetLang: targetLang || 'ko'
    });
    res.json({ success: true, story });
}));

router.post("/analyze-menu-list", catchAsync(async (req, res) => {
    const { menuNames, menuData, categories } = req.body;
    if (!menuNames || !Array.isArray(menuNames)) {
        return res.status(400).json({ success: false, error: "menuNames 배열이 필요합니다." });
    }
    const suggestions = await aiService.analyzeMenuList(menuNames, categories || [], menuData || []);
    res.json({ success: true, suggestions });
}));

router.post("/propose-menu-full", validateBody(["name"]), catchAsync(async (req, res) => {
    const { name, categoryName } = req.body;
    const proposal = await aiService.proposeMenuFull({ name, categoryName });
    res.json({ success: true, proposal });
}));

router.post("/recommend-pairing", validateId(["store_id"]), catchAsync(async (req, res) => {
    const { store_id: _store_id, product_ids } = req.body;

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
        return res.json({ recommendations: [] });
    }

    const pairingData = await prisma.order_items.groupBy({
        by: ['product_id'],
        where: {
            order_id: {
                in: await prisma.order_items.findMany({
                    where: { product_id: { in: product_ids.map(id => parseInt(id)) } },
                    select: { order_id: true }
                }).then(items => items.map(i => i.order_id))
            },
            product_id: {
                notIn: product_ids.map(id => parseInt(id))
            }
        },
        _count: {
            product_id: true
        },
        orderBy: {
            _count: {
                product_id: 'desc'
            }
        },
        take: 10
    });

    const recommendedProducts = await prisma.products.findMany({
        where: {
            id: { in: pairingData.map(p => p.product_id).filter(id => id !== null) },
            is_active: true,
            is_sold_out: false
        },
        include: {
            categories: { select: { name: true } }
        }
    });

    const enrichedRecommendations = await Promise.all(recommendedProducts.map(async (product) => {
        const count = pairingData.find(p => p.product_id === product.id)?._count.product_id || 0;
        return {
            ...product,
            pairing_score: count,
            recommend_reason: `${product.name}은(는) 현재 담으신 메뉴와 함께 가장 많이 선택된 인기 조합입니다.`
        };
    }));

    res.json({ recommendations: enrichedRecommendations.sort((a, b) => b.pairing_score - a.pairing_score) });
}));

module.exports = router;
