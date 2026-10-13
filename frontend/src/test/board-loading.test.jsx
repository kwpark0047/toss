import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { test, expect, vi } from 'vitest';
const posts = vi.hoisted(() => vi.fn());
vi.mock('../api', () => ({ boardAPI: { getPosts: posts, getTrending: () => Promise.resolve({data: []}) } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: {id: 1, role: 'super_admin'} }) }));
import BoardList from '../components/board/BoardList';
test('board load failure is visible and a retry restores posts', async () => {
  posts.mockRejectedValueOnce(Error('offline')).mockResolvedValue({data: {posts: [{id: 42, title: '공지 회귀 확인', board_type: 'notice', created_at: new Date().toISOString()}], total: 1, totalPages: 1}});
  render(<MemoryRouter><BoardList /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('게시글을 불러오지 못했습니다');
  fireEvent.click(screen.getByText('다시 시도'));
  await screen.findByText('공지 회귀 확인');
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});
