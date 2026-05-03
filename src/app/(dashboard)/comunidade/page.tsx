"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { CommunityFeed } from "@/components/community/community-feed";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { Textarea } from "@/components/ui/textarea";
import {
  createCommunityComment,
  createCommunityPost,
  getCommunityFeed,
  toggleCommunityReaction,
} from "@/services/community-service";
import { CommunityFeedData } from "@/services/types";
import { UserRole } from "@/types";

const COMMUNITY_TABS = ["Feed", "Treinos", "Eventos", "Resultados"] as const;
const PAGE_SIZE = 12;

export default function ComunidadePage() {
  const { accessToken, userRole, userRoles } = useAuthToken();
  const [feed, setFeed] = useState<CommunityFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postText, setPostText] = useState("");
  const [postTab, setPostTab] = useState<(typeof COMMUNITY_TABS)[number]>("Feed");
  const [publishing, setPublishing] = useState(false);

  const canPublish =
    userRole === UserRole.ATHLETE ||
    userRole === UserRole.PREMIUM_ATHLETE ||
    userRole === UserRole.ADMIN ||
    userRole === UserRole.SUPER_ADMIN ||
    userRoles.includes(UserRole.ATHLETE) ||
    userRoles.includes(UserRole.PREMIUM_ATHLETE);
  const canReact = canPublish;
  const hasPosts = (feed?.posts?.length ?? 0) > 0;
  const hasMore = feed?.cursor?.hasMore ?? feed?.pagination?.hasMore ?? false;
  const nextCursor = feed?.cursor?.next ?? null;

  const loadFeed = async (params?: { append?: boolean; page?: number; cancelled?: { value: boolean } }) => {
    const append = params?.append ?? false;
    const page = params?.page ?? 1;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const payload = await getCommunityFeed({
        accessToken,
        page,
        limit: PAGE_SIZE,
        cursor: append ? nextCursor : null,
      });

      if (params?.cancelled?.value) return;

      if (append && feed) {
        const existingIds = new Set(feed.posts.map((post) => post.id));
        const appendedPosts = payload.data.posts.filter((post) => !existingIds.has(post.id));
        setFeed({
          ...payload.data,
          posts: [...feed.posts, ...appendedPosts],
        });
      } else {
        setFeed(payload.data);
      }
    } catch (loadError) {
      if (params?.cancelled?.value) return;
      const message = loadError instanceof Error ? loadError.message : "Nao foi possivel carregar a comunidade.";
      if (!append) {
        setFeed(null);
        setError(message);
      }
      toast.error(message);
    } finally {
      if (!params?.cancelled?.value) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    const cancelled = { value: false };
    void loadFeed({ cancelled, page: 1 });

    return () => {
      cancelled.value = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comunidade"
        subtitle="Feed da assessoria com publicações, comentários e interações de atletas."
      />

      {canPublish ? (
        <SectionCard
          title="Nova publicação"
          description="Atletas e administração podem compartilhar atualizações com o grupo."
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {COMMUNITY_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPostTab(tab)}
                  className={
                    tab === postTab
                      ? "rounded-full border border-[#2f5d8f] bg-[#12355d] px-3 py-1 text-xs font-semibold text-[#d6e8ff]"
                      : "rounded-full border border-[#24486f] bg-[#0f233d] px-3 py-1 text-xs text-[#9bb8dd] transition hover:bg-[#13304f]"
                  }
                >
                  {tab}
                </button>
              ))}
            </div>
            <Textarea
              id="community-post-text"
              value={postText}
              onChange={(event) => setPostText(event.target.value)}
              className="min-h-24 border-white/15 bg-[#0F2743] text-white"
              placeholder="Compartilhe seu treino, resultado ou recado para o grupo..."
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-300">{postText.length}/500</p>
              <ActionButton
                disabled={publishing || postText.trim().length < 3}
                onClick={async () => {
                  setPublishing(true);
                  try {
                    await createCommunityPost({ accessToken, content: postText.trim(), tab: postTab });
                    setPostText("");
                    setPostTab("Feed");
                    await loadFeed({ page: 1 });
                    toast.success("Publicação enviada para a comunidade.");
                  } catch (postError) {
                    toast.error(postError instanceof Error ? postError.message : "Falha ao publicar.");
                  } finally {
                    setPublishing(false);
                  }
                }}
              >
                {publishing ? "Publicando..." : "Publicar"}
              </ActionButton>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Feed social" description="Módulo dedicado para engajamento da comunidade">
        {loading ? (
          <LoadingState lines={4} />
        ) : feed && hasPosts ? (
          <>
            <CommunityFeed
              data={feed}
              canComment={canPublish}
              canReact={canReact}
              onCommentSubmit={async (postId, text) => {
                try {
                  await createCommunityComment({ accessToken, postId, text });
                  await loadFeed({ page: 1 });
                  toast.success("Comentário enviado.");
                } catch (commentError) {
                  toast.error(commentError instanceof Error ? commentError.message : "Falha ao comentar.");
                }
              }}
              onReactionToggle={async (postId, type) => {
                try {
                  await toggleCommunityReaction({ accessToken, postId, type });
                  await loadFeed({ page: 1 });
                } catch (reactionError) {
                  toast.error(reactionError instanceof Error ? reactionError.message : "Falha ao reagir.");
                }
              }}
            />
            {hasMore ? (
              <div className="flex justify-center pt-2">
                <ActionButton
                  intent="secondary"
                  size="sm"
                  disabled={loadingMore || !nextCursor}
                  onClick={() => void loadFeed({ append: true, page: 1 })}
                >
                  {loadingMore ? "Carregando..." : "Carregar mais"}
                </ActionButton>
              </div>
            ) : null}
          </>
        ) : feed ? (
          <EmptyState
            title="Comunidade ainda sem publicações"
            description={
              feed.message ??
              "Este espaco esta ativo, mas sua organizacao ainda nao publicou nenhum conteudo."
            }
            action={
              canPublish ? (
                <ActionButton
                  size="sm"
                  onClick={() => {
                    const element = document.getElementById("community-post-text");
                    element?.scrollIntoView({ behavior: "smooth", block: "center" });
                    element?.focus();
                  }}
                >
                  Criar primeira publicação
                </ActionButton>
              ) : (
                <ActionButton size="sm" intent="secondary" onClick={() => void loadFeed({ page: 1 })}>
                  Atualizar feed
                </ActionButton>
              )
            }
          />
        ) : (
          <EmptyState
            title="Comunidade indisponível"
            description={error ?? "Não foi possível carregar o feed neste momento."}
            action={
              <ActionButton size="sm" intent="secondary" onClick={() => void loadFeed({ page: 1 })}>
                Tentar novamente
              </ActionButton>
            }
          />
        )}
      </SectionCard>
    </div>
  );
}
