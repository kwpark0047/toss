-- Migration: add_food_truck_design_theme
-- Description: 사업자계정 트럭 디자인 쇼케이스 관리 — 고객 노출용 디자인 콘셉트 선택 저장

ALTER TABLE "food_trucks" ADD COLUMN "design_theme" TEXT NOT NULL DEFAULT 'concept1';