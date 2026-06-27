import React from 'react';
import { motion } from 'framer-motion';

const CategoryTabs = ({ categories, selectedCategory, onSelectCategory }) => {
  return (
    <div className="sticky top-16 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 overflow-x-auto no-scrollbar">
      <div className="container mx-auto px-4 flex items-center gap-1 min-w-max h-12">
        {categories.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className="relative px-4 h-full flex items-center justify-center transition-colors"
            >
              <span className={`text-sm font-bold ${
                isActive ? 'text-primary' : 'text-slate-400'
              }`}>
                {category}
              </span>
              {isActive && (
                <motion.div
                  layoutId="activeCategory"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryTabs;
