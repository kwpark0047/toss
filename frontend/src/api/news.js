import axios from 'axios';
import { API_URL } from './client';

export const newsAPI = {
  getNews: async ({ page = 1, limit = 20, source, category } = {}) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });
    
    if (source) params.append('source', source);
    if (category) params.append('category', category);

    const response = await axios.get(`${API_URL}/news?${params.toString()}`);
    return response.data;
  },

  triggerCrawl: async () => {
    const response = await axios.post(`${API_URL}/news/crawl`);
    return response.data;
  }
};
