import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CommunityHttpClient } from '@/modules/community/infrastructure/community-http-client';
import type { CommunityCategory, CommunityPost, CreateCommunityPostInput } from '@/modules/community/domain/community-post';

interface UseCommunityResult {
    category: CommunityCategory;
    setCategory: (category: CommunityCategory) => void;
    posts: CommunityPost[];
    isLoading: boolean;
    isPosting: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createPost: (input: Omit<CreateCommunityPostInput, 'category'>) => Promise<void>;
    confirmPost: (id: string) => Promise<void>;
}

export function useCommunity(initialCategory: CommunityCategory = 'FILA_RU'): UseCommunityResult {
    const client = useMemo(() => new CommunityHttpClient(), []);
    const [category, setCategory] = useState<CommunityCategory>(initialCategory);
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPosting, setIsPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Guards against a slow response for a previous category overwriting the
    // feed after the user has already switched tabs.
    const requestIdRef = useRef(0);

    const load = useCallback(async (target: CommunityCategory) => {
        const requestId = ++requestIdRef.current;
        setIsLoading(true);
        setError(null);
        try {
            const result = await client.listPosts(target);
            if (requestId === requestIdRef.current) {
                setPosts(result);
            }
        } catch (caught) {
            if (requestId === requestIdRef.current) {
                setError(caught instanceof Error ? caught.message : 'Nao foi possivel carregar a comunidade.');
                setPosts([]);
            }
        } finally {
            if (requestId === requestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [client]);

    useEffect(() => {
        void load(category);
    }, [category, load]);

    const refresh = useCallback(() => load(category), [load, category]);

    const createPost = useCallback(async (input: Omit<CreateCommunityPostInput, 'category'>) => {
        setIsPosting(true);
        setError(null);
        try {
            const created = await client.createPost({ ...input, category });
            // Optimistically prepend so the author sees their report immediately.
            setPosts((current) => [created, ...current]);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Nao foi possivel publicar o relato.');
            throw caught;
        } finally {
            setIsPosting(false);
        }
    }, [client, category]);

    const confirmPost = useCallback(async (id: string) => {
        try {
            const { confirmCount } = await client.confirmPost(id);
            setPosts((current) => current.map((post) => (post.id === id ? { ...post, confirmCount } : post)));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Nao foi possivel confirmar o relato.');
        }
    }, [client]);

    return { category, setCategory, posts, isLoading, isPosting, error, refresh, createPost, confirmPost };
}
