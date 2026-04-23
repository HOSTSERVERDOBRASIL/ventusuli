"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame, HandHeart, MessageCircle, Sparkles } from "lucide-react";
import { ActionButton } from "@/components/system/action-button";
import { StatusBadge } from "@/components/system/status-badge";
import {
  CommunityFeedData,
  CommunityPost,
  CommunityReactionType,
} from "@/services/types";

const IMAGE_TONE_CLASS: Record<NonNullable<CommunityPost["image"]>["tone"], string> = {
  ocean: "bg-[linear-gradient(135deg,#155e75,#1d4ed8)]",
  sunset: "bg-[linear-gradient(135deg,#9a3412,#7c3aed)]",
  forest: "bg-[linear-gradient(135deg,#14532d,#0f766e)]",
  violet: "bg-[linear-gradient(135deg,#4c1d95,#0369a1)]",
};

const REACTION_LABEL: Record<CommunityReactionType, string> = {
  LIKE: "Curtir",
  FIRE: "Motivado",
  APPLAUSE: "Parabens",
};

const REACTION_ICON: Record<CommunityReactionType, typeof HandHeart> = {
  LIKE: HandHeart,
  FIRE: Flame,
  APPLAUSE: Sparkles,
};

const ROLE_LABEL: Record<CommunityPost["role"], string> = {
  ATHLETE: "ATLETA",
  COACH: "COACH",
  ORGANIZER: "EQUIPE",
};

interface CommunityFeedProps {
  data: CommunityFeedData;
  maxPosts?: number;
  showComments?: boolean;
  compact?: boolean;
  canComment?: boolean;
  onCommentSubmit?: (postId: string, text: string) => Promise<void>;
  canReact?: boolean;
  onReactionToggle?: (postId: string, type: CommunityReactionType) => Promise<void>;
}

export function CommunityFeed({
  data,
  maxPosts,
  showComments = true,
  compact = false,
  canComment = false,
  onCommentSubmit,
  canReact = false,
  onReactionToggle,
}: CommunityFeedProps) {
  const [activeTab, setActiveTab] = useState(data.tabs[0] ?? "Feed");
  const [activeReactions, setActiveReactions] = useState<Record<string, Record<CommunityReactionType, boolean>>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});
  const [reactionSubmitting, setReactionSubmitting] = useState<Record<string, boolean>>({});

  const posts = useMemo(() => {
    const source = activeTab === "Feed" ? data.posts : data.posts.filter((post) => post.tab === activeTab);
    return typeof maxPosts === "number" ? source.slice(0, maxPosts) : source;
  }, [activeTab, data.posts, maxPosts]);

  useEffect(() => {
    if (!data.tabs.length) return;
    setActiveTab((current) => (data.tabs.includes(current) ? current : data.tabs[0]));
  }, [data.tabs]);

  const isReactionActive = (postId: string, reactionType: CommunityReactionType, fallback = false): boolean =>
    activeReactions[postId]?.[reactionType] ?? fallback;

  const toggleReaction = (postId: string, reactionType: CommunityReactionType) => {
    setActiveReactions((prev) => ({
      ...prev,
      [postId]: {
        ...(prev[postId] ?? {}),
        [reactionType]: !isReactionActive(postId, reactionType, false),
      },
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        {data.tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={tab === activeTab
              ? "rounded-full border border-[#2f5d8f] bg-[#12355d] px-3 py-1 font-semibold text-[#d6e8ff]"
              : "rounded-full border border-[#24486f] bg-[#0f233d] px-3 py-1 text-[#9bb8dd] transition hover:bg-[#13304f]"}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {!posts.length ? (
          <div className="rounded-xl border border-[#24486f] bg-[#0f233d] p-4 text-sm text-[#9dbce2]">
            Sem posts no momento.
          </div>
        ) : null}
        {posts.map((post) => (
          <article key={post.id} className="rounded-xl border border-[#24486f] bg-[#0f233d] p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2e5f90] bg-[#12355d] text-xs font-bold text-white">
                  {post.avatarInitials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{post.author}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-[#8eb0dc]">{post.timeAgo}</p>
                    <StatusBadge label={ROLE_LABEL[post.role]} tone={post.role === "ORGANIZER" ? "info" : post.role === "COACH" ? "warning" : "neutral"} className="text-[10px]" />
                  </div>
                </div>
              </div>
              <ActionButton size="sm" intent="secondary">
                Interagir
              </ActionButton>
            </div>

            <p className={`text-sm leading-6 text-[#d4e5ff] ${compact ? "line-clamp-3" : ""}`}>{post.content}</p>

            {post.image ? (
              <div className={`mt-3 rounded-lg border border-[#2f5d8f] p-3 text-white ${compact ? "h-20" : "h-28"} ${IMAGE_TONE_CLASS[post.image.tone]}`}>
                <p className="text-sm font-semibold">{post.image.title}</p>
                {post.image.subtitle ? <p className="mt-1 text-xs text-white/90">{post.image.subtitle}</p> : null}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {post.reactions.map((reaction) => {
                const Icon = REACTION_ICON[reaction.type];
                const active = isReactionActive(post.id, reaction.type, reaction.activeByDefault ?? false);
                const count = reaction.count + (active && !(reaction.activeByDefault ?? false) ? 1 : 0) - (!active && (reaction.activeByDefault ?? false) ? 1 : 0);
                const isPersistedPost = !post.id.startsWith("post-");
                const isPendingReaction = reactionSubmitting[`${post.id}:${reaction.type}`] ?? false;

                return (
                  <button
                    key={reaction.type}
                    type="button"
                    onClick={async () => {
                      if (canReact && onReactionToggle && isPersistedPost) {
                        const key = `${post.id}:${reaction.type}`;
                        setReactionSubmitting((prev) => ({ ...prev, [key]: true }));
                        try {
                          await onReactionToggle(post.id, reaction.type);
                        } finally {
                          setReactionSubmitting((prev) => ({ ...prev, [key]: false }));
                        }
                        return;
                      }

                      toggleReaction(post.id, reaction.type);
                    }}
                    disabled={isPendingReaction}
                    className={active
                      ? "inline-flex items-center gap-1.5 rounded-full border border-[#46a2ff] bg-[#133c64] px-2.5 py-1 text-xs text-[#d8ebff]"
                      : "inline-flex items-center gap-1.5 rounded-full border border-[#24486f] bg-[#0b1d34] px-2.5 py-1 text-xs text-[#9dbce2] hover:bg-[#123255]"}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {REACTION_LABEL[reaction.type]} {count}
                  </button>
                );
              })}

              <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-[#24486f] bg-[#0b1d34] px-2.5 py-1 text-xs text-[#9dbce2] hover:bg-[#123255]">
                <MessageCircle className="h-3.5 w-3.5" />
                Comentarios {post.comments.length}
              </button>
            </div>

            {showComments && post.comments.length ? (
              <div className="mt-3 space-y-2">
                {post.comments.slice(0, 2).map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-[#1f4064] bg-[#0b1d34] px-2.5 py-2">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#2e5f90] bg-[#12355d] text-[10px] font-bold text-white">
                        {comment.avatarInitials}
                      </div>
                      <p className="text-xs font-semibold text-white">{comment.author}</p>
                      <p className="text-[11px] text-[#8eb0dc]">{comment.timeAgo}</p>
                    </div>
                    <p className="text-xs text-[#c8dcfa]">{comment.text}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {showComments && canComment && onCommentSubmit && !post.id.startsWith("post-") ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={commentDrafts[post.id] ?? ""}
                  onChange={(event) =>
                    setCommentDrafts((prev) => ({
                      ...prev,
                      [post.id]: event.target.value,
                    }))
                  }
                  placeholder="Escreva um comentário..."
                  className="w-full rounded-lg border border-[#2f5d8f] bg-[#0b1d34] px-3 py-2 text-xs text-white outline-none placeholder:text-[#8eb0dc]"
                  maxLength={280}
                  rows={2}
                />
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-[#8eb0dc]">{(commentDrafts[post.id] ?? "").length}/280</p>
                  <ActionButton
                    size="sm"
                    intent="secondary"
                    disabled={commentSubmitting[post.id] || (commentDrafts[post.id] ?? "").trim().length < 2}
                    onClick={async () => {
                      const text = (commentDrafts[post.id] ?? "").trim();
                      if (text.length < 2) return;
                      setCommentSubmitting((prev) => ({ ...prev, [post.id]: true }));
                      try {
                        await onCommentSubmit(post.id, text);
                        setCommentDrafts((prev) => ({ ...prev, [post.id]: "" }));
                      } finally {
                        setCommentSubmitting((prev) => ({ ...prev, [post.id]: false }));
                      }
                    }}
                  >
                    {commentSubmitting[post.id] ? "Enviando..." : "Comentar"}
                  </ActionButton>
                </div>
              </div>
            ) : null}

            {post.ctaLabel ? (
              <div className="mt-3">
                <ActionButton size="sm">{post.ctaLabel}</ActionButton>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
