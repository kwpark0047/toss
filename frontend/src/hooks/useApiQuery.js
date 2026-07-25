import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { extractErrorMessage } from '@/lib/errorUtils';
import { toast } from 'sonner';

/**
 * useApiQuery — TanStack Query 기반 표준 데이터 조회 훅
 *
 * 기존 useQuery 호출을 이 훅으로 일원화:
 *  - 공통 staleTime, retry 정책 적용
 *  - 에러 시 콘솔 로깅
 *
 * @param {import('@tanstack/react-query').UseQueryOptions} options
 * @returns {import('@tanstack/react-query').UseQueryResult}
 *
 * @example
 * const { data, isLoading, error } = useApiQuery({
 *   queryKey: ['stores', storeId],
 *   queryFn: () => storesAPI.getById(storeId),
 * });
 */
export function useApiQuery(options) {
  return useQuery({
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    ...options,
  });
}

/**
 * useApiMutation — 표준 뮤테이션 훅 (에러 토스트 내장)
 *
 * onSuccess/onError를 자유롭게 덮어쓰려면 options.successMessage 등을 사용.
 *
 * @param {{
 *   mutationFn: (...args: any[]) => Promise<any>,
 *   successMessage?: string,
 *   onSuccess?: (data: any, variables: any, context: any) => void,
 *   onError?: (error: any, variables: any, context: any) => void,
 *   invalidateQueries?: string[][],
 *   [key: string]: any
 * }} options
 * @returns {import('@tanstack/react-query').UseMutationResult}
 *
 * @example
 * const deleteMenu = useApiMutation({
 *   mutationFn: (id) => productsAPI.delete(id),
 *   successMessage: '메뉴가 삭제되었습니다.',
 *   invalidateQueries: [['store-menus', storeId]],
 * });
 * deleteMenu.mutate(menuId);
 */
export function useApiMutation(options) {
  const queryClient = useQueryClient();
  const {
    successMessage,
    invalidateQueries,
    onSuccess: userOnSuccess,
    onError: userOnError,
    ...mutationOptions
  } = options;

  return useMutation({
    ...mutationOptions,
    onSuccess: (data, variables, context) => {
      if (successMessage) {
        toast.success(successMessage);
      }
      if (invalidateQueries?.length) {
        invalidateQueries.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      if (typeof userOnSuccess === 'function') {
        userOnSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      const msg = extractErrorMessage(error);
      toast.error(msg);
      if (typeof userOnError === 'function') {
        userOnError(error, variables, context);
      }
    },
  });
}
