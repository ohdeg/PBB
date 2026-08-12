import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { srankoApi } from '../api/srankoApi';
import { Dialog } from '../components/ui/Dialog';
import {
  SRANKO_COMMUNITY,
  SRANKO_COMMUNITY_MINE,
  SRANKO_COMMUNITY_NEW,
} from '../features/sranko/paths';
import { resizeImageForUpload } from '../features/sranko/resizeImageForUpload';
import {
  postImageUrls,
  SrankoImageCarousel,
} from '../features/sranko/SrankoImageCarousel';
import type { SrankoComment, SrankoLookPicker, SrankoPost } from '../features/sranko/types';
import { useSrankoMutations } from '../features/sranko/useSrankoStore';
import { useAuthStore } from '../stores/authStore';

type CommunityStubKind = 'new' | 'mine' | 'detail';

function resolveKind(pathname: string): CommunityStubKind {
  if (pathname.endsWith('/new')) {
    return 'new';
  }
  if (pathname.endsWith('/mine')) {
    return 'mine';
  }
  return 'detail';
}

function formatPostMeta(post: Pick<SrankoPost, 'readCount' | 'likeCount' | 'commentCount'>): string {
  return `조회 ${post.readCount} · 좋아요 ${post.likeCount} · 댓글 ${post.commentCount}`;
}

async function sharePost(post: SrankoPost): Promise<void> {
  const url = `${window.location.origin}/hobbies/sranko/community/${post.id}`;
  if (navigator.share) {
    await navigator.share({ title: post.subject, text: post.subject, url });
    return;
  }
  await navigator.clipboard.writeText(url);
}

export function SrankoCommunityStubPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { postId } = useParams<{ postId: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.userId);
  const suppressLoginRedirect = useAuthStore((s) => s.suppressLoginRedirect);
  const kind = resolveKind(location.pathname);
  const { removePost, openPost } = useSrankoMutations();

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<SrankoPost | null>(null);
  const [mine, setMine] = useState<SrankoPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<SrankoComment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<SrankoComment | null>(null);
  const [shareHint, setShareHint] = useState('');

  const loadComments = useCallback(async (id: string) => {
    setComments(await srankoApi.listComments(id));
  }, []);

  useEffect(() => {
    if (kind !== 'detail' || !postId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const bumped = await openPost(postId);
        if (cancelled) {
          return;
        }
        setDetail(bumped);
        await loadComments(postId);
      } catch (e: unknown) {
        try {
          const post = await srankoApi.getPost(postId);
          if (cancelled) {
            return;
          }
          setDetail(post);
          await loadComments(postId);
        } catch {
          if (!cancelled) {
            setDetail(null);
            setError(e instanceof Error ? e.message : '게시글을 불러오지 못했어요.');
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, postId, openPost, loadComments]);

  useEffect(() => {
    if (kind !== 'mine' || !accessToken) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    void srankoApi
      .listMyPosts()
      .then((posts) => {
        if (!cancelled) {
          setMine(posts);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMine([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [kind, accessToken]);

  const rootComments = useMemo(
    () => comments.filter((c) => c.parentId == null),
    [comments],
  );
  const repliesByParent = useMemo(() => {
    const map = new Map<string, SrankoComment[]>();
    for (const c of comments) {
      if (c.parentId == null) {
        continue;
      }
      const list = map.get(c.parentId) ?? [];
      list.push(c);
      map.set(c.parentId, list);
    }
    return map;
  }, [comments]);

  const requireLogin = (from: string) => {
    void navigate('/login', { state: { from } });
  };

  if ((kind === 'mine' || kind === 'new') && !accessToken && !suppressLoginRedirect) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: kind === 'mine' ? SRANKO_COMMUNITY_MINE : SRANKO_COMMUNITY_NEW,
        }}
      />
    );
  }

  if (kind === 'detail' && postId) {
    if (loading) {
      return (
        <section className="sranko-panel">
          <div className="sranko-empty">불러오는 중…</div>
        </section>
      );
    }
    if (!detail) {
      return (
        <section className="sranko-panel">
          <h1>게시글</h1>
          <div className="sranko-empty">글을 찾을 수 없습니다.</div>
          {error ? <p className="sranko-error">{error}</p> : null}
          <p className="sranko-footer-links">
            <Link className="sranko-link" to={SRANKO_COMMUNITY}>
              커뮤니티로
            </Link>
          </p>
        </section>
      );
    }
    const isOwner = Boolean(userId && detail.authorUserId === userId);

    const onTogglePostLike = async () => {
      if (!accessToken) {
        requireLogin(location.pathname);
        return;
      }
      setBusy(true);
      setError('');
      try {
        const next = await srankoApi.togglePostLike(detail.id);
        setDetail({
          ...detail,
          likeCount: next.likeCount,
          likedByMe: next.likedByMe,
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '좋아요에 실패했어요.');
      } finally {
        setBusy(false);
      }
    };

    const onShare = async () => {
      setShareHint('');
      try {
        await sharePost(detail);
        if (!navigator.share) {
          setShareHint('링크를 복사했어요.');
        }
      } catch {
        setShareHint('공유를 취소했거나 실패했어요.');
      }
    };

    const onSubmitComment = async () => {
      if (!accessToken) {
        requireLogin(location.pathname);
        return;
      }
      const body = commentBody.trim();
      if (!body) {
        return;
      }
      setBusy(true);
      setError('');
      try {
        await srankoApi.createComment(detail.id, {
          body,
          parentId: replyTo?.id ?? null,
        });
        setCommentBody('');
        setReplyTo(null);
        const refreshed = await srankoApi.getPost(detail.id);
        setDetail(refreshed);
        await loadComments(detail.id);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '댓글 작성에 실패했어요.');
      } finally {
        setBusy(false);
      }
    };

    const onDeleteComment = async (comment: SrankoComment) => {
      if (!accessToken) {
        return;
      }
      if (!window.confirm('댓글을 삭제할까요?')) {
        return;
      }
      setBusy(true);
      setError('');
      try {
        await srankoApi.deleteComment(detail.id, comment.id);
        const refreshed = await srankoApi.getPost(detail.id);
        setDetail(refreshed);
        await loadComments(detail.id);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '댓글 삭제에 실패했어요.');
      } finally {
        setBusy(false);
      }
    };

    const onToggleCommentLike = async (comment: SrankoComment) => {
      if (!accessToken) {
        requireLogin(location.pathname);
        return;
      }
      setBusy(true);
      setError('');
      try {
        const next = await srankoApi.toggleCommentLike(detail.id, comment.id);
        setComments((prev) =>
          prev.map((c) =>
            c.id === comment.id
              ? { ...c, likeCount: next.likeCount, likedByMe: next.likedByMe }
              : c,
          ),
        );
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '댓글 좋아요에 실패했어요.');
      } finally {
        setBusy(false);
      }
    };

    const renderComment = (comment: SrankoComment, isReply: boolean) => {
      const canDelete =
        Boolean(userId) &&
        (comment.authorUserId === userId || detail.authorUserId === userId);
      return (
        <li
          key={comment.id}
          className={`sranko-comment${isReply ? ' sranko-comment--reply' : ''}`}
        >
          <div className="sranko-comment__meta">
            <strong>{comment.authorNickname}</strong>
            <span>{new Date(comment.createdAt).toLocaleString('ko-KR')}</span>
          </div>
          <p className="sranko-comment__body">{comment.body}</p>
          <div className="sranko-comment__actions">
            <button
              type="button"
              className="sranko-btn sranko-btn--ghost sranko-btn--sm"
              disabled={busy}
              onClick={() => void onToggleCommentLike(comment)}
            >
              {comment.likedByMe ? '♥' : '♡'} {comment.likeCount}
            </button>
            {!isReply ? (
              <button
                type="button"
                className="sranko-btn sranko-btn--ghost sranko-btn--sm"
                disabled={busy}
                onClick={() => {
                  if (!accessToken) {
                    requireLogin(location.pathname);
                    return;
                  }
                  setReplyTo(comment);
                }}
              >
                답글
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className="sranko-btn sranko-btn--ghost sranko-btn--sm"
                disabled={busy}
                onClick={() => void onDeleteComment(comment)}
              >
                삭제
              </button>
            ) : null}
          </div>
        </li>
      );
    };

    return (
      <section className="sranko-panel">
        <h1>{detail.subject}</h1>
        <p className="sranko-muted">
          {detail.authorNickname} · {formatPostMeta(detail)} ·{' '}
          {new Date(detail.createdAt).toLocaleString('ko-KR')}
        </p>
        <SrankoImageCarousel
          urls={postImageUrls(detail)}
          variant="detail"
          alt={detail.subject}
        />
        <p style={{ whiteSpace: 'pre-wrap' }}>{detail.content}</p>

        <div className="sranko-post-actions" role="group" aria-label="게시글 액션">
          <button
            type="button"
            className={`sranko-btn sranko-btn--sm${detail.likedByMe ? ' sranko-btn--primary' : ' sranko-btn--ghost'}`}
            disabled={busy}
            onClick={() => void onTogglePostLike()}
          >
            {detail.likedByMe ? '♥ 좋아요' : '♡ 좋아요'} {detail.likeCount}
          </button>
          <button
            type="button"
            className="sranko-btn sranko-btn--ghost sranko-btn--sm"
            disabled={busy}
            onClick={() => void onShare()}
          >
            공유
          </button>
          <a className="sranko-btn sranko-btn--ghost sranko-btn--sm" href="#sranko-comments">
            댓글 {detail.commentCount}
          </a>
        </div>
        {shareHint ? <p className="sranko-muted">{shareHint}</p> : null}
        {error ? <p className="sranko-error">{error}</p> : null}

        <div className="sranko-modal__actions" style={{ marginTop: '1rem' }}>
          <Link className="sranko-btn sranko-btn--ghost" to={SRANKO_COMMUNITY}>
            목록
          </Link>
          {isOwner ? (
            <button
              type="button"
              className="sranko-btn sranko-btn--ghost"
              onClick={() => {
                if (window.confirm('삭제할까요?')) {
                  void removePost(detail.id).then(() => {
                    void navigate(SRANKO_COMMUNITY);
                  });
                }
              }}
            >
              삭제
            </button>
          ) : null}
        </div>

        <section id="sranko-comments" className="sranko-comments">
          <h2 className="sranko-comments__title">댓글 {detail.commentCount}</h2>
          <div className="sranko-comment-form">
            {replyTo ? (
              <p className="sranko-muted">
                {replyTo.authorNickname}님에게 답글{' '}
                <button
                  type="button"
                  className="sranko-link"
                  onClick={() => setReplyTo(null)}
                >
                  취소
                </button>
              </p>
            ) : null}
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={accessToken ? '댓글을 입력하세요' : '로그인 후 댓글을 작성할 수 있어요'}
              disabled={busy || !accessToken}
            />
            <button
              type="button"
              className="sranko-btn sranko-btn--primary sranko-btn--sm"
              disabled={busy || !commentBody.trim()}
              onClick={() => {
                if (!accessToken) {
                  requireLogin(location.pathname);
                  return;
                }
                void onSubmitComment();
              }}
            >
              {accessToken ? '등록' : '로그인하고 작성'}
            </button>
          </div>
          {rootComments.length === 0 ? (
            <p className="sranko-muted">아직 댓글이 없습니다.</p>
          ) : (
            <ul className="sranko-comment-list">
              {rootComments.map((root) => (
                <li key={root.id} className="sranko-comment-thread">
                  <ul className="sranko-comment-list">
                    {renderComment(root, false)}
                    {(repliesByParent.get(root.id) ?? []).map((reply) =>
                      renderComment(reply, true),
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    );
  }

  if (kind === 'mine') {
    return (
      <section className="sranko-panel">
        <h1>MY STYLE</h1>
        <p className="sranko-panel__lede">내가 올린 게시만 모읍니다.</p>
        {loading ? (
          <div className="sranko-empty">불러오는 중…</div>
        ) : mine.length === 0 ? (
          <div className="sranko-empty">아직 내 게시가 없습니다.</div>
        ) : (
          <div className="sranko-grid">
            {mine.map((post) => (
              <article key={post.id} className="sranko-card">
                <SrankoImageCarousel
                  urls={postImageUrls(post)}
                  variant="card"
                  alt={post.subject}
                  linkTo={`/hobbies/sranko/community/${post.id}`}
                />
                <Link
                  className="sranko-card__body sranko-card__body--link"
                  to={`/hobbies/sranko/community/${post.id}`}
                >
                  <strong>{post.subject}</strong>
                  <span>{formatPostMeta(post)}</span>
                </Link>
              </article>
            ))}
          </div>
        )}
        <p className="sranko-footer-links">
          <Link className="sranko-link" to={SRANKO_COMMUNITY}>
            커뮤니티로
          </Link>
        </p>
      </section>
    );
  }

  // kind === 'new' — keep existing create form below via reading original file tail
  return <CommunityNewForm />;
}

function CommunityNewForm() {
  const navigate = useNavigate();
  const { savePost, uploadImage } = useSrankoMutations();
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lookPickerOpen, setLookPickerOpen] = useState(false);
  const [pickerLooks, setPickerLooks] = useState<SrankoLookPicker[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(() => new Set());

  const maxImages = 10;

  const openLookPicker = () => {
    setLookPickerOpen(true);
    setPickerError('');
    setPickerSelected(new Set());
    setPickerLoading(true);
    void srankoApi
      .listLooksPicker()
      .then((rows) => setPickerLooks(rows))
      .catch((err: unknown) => {
        setPickerLooks([]);
        setPickerError(err instanceof Error ? err.message : '룩을 불러오지 못했어요.');
      })
      .finally(() => setPickerLoading(false));
  };

  const togglePickerLook = (look: SrankoLookPicker) => {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(look.imageUrl)) {
        next.delete(look.imageUrl);
      } else {
        next.add(look.imageUrl);
      }
      return next;
    });
  };

  const applyLookPicker = () => {
    const remaining = maxImages - imageUrls.length;
    if (remaining <= 0) {
      setError(`이미지는 최대 ${maxImages}장까지입니다.`);
      setLookPickerOpen(false);
      return;
    }
    const chosen = [...pickerSelected].filter((url) => !imageUrls.includes(url));
    const toAdd = chosen.slice(0, remaining);
    if (chosen.length > remaining) {
      setError(`이미지는 최대 ${maxImages}장까지입니다.`);
    } else {
      setError('');
    }
    if (toAdd.length > 0) {
      setImageUrls((prev) => [...prev, ...toAdd]);
    }
    setLookPickerOpen(false);
  };

  return (
    <section className="sranko-panel">
      <h1>글쓰기</h1>
      <p className="sranko-panel__lede">
        룩 사진과 짧은 소개를 올려 보세요. 이미지는 최대 {maxImages}장 · 파일 또는 내 룩에서 선택.
      </p>
      {error ? <p className="sranko-error">{error}</p> : null}
      <label className="sranko-field">
        <span>제목</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className="sranko-field">
        <span>내용</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          disabled={busy}
        />
      </label>
      <div className="sranko-field">
        <span>이미지 ({imageUrls.length}/{maxImages})</span>
        <div className="sranko-compose-image-actions">
          <label className="sranko-btn sranko-btn--ghost sranko-btn--sm sranko-compose-file">
            파일 올리기
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={busy || imageUrls.length >= maxImages}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                if (files.length === 0) {
                  return;
                }
                const remaining = maxImages - imageUrls.length;
                const batch = files.slice(0, remaining);
                if (files.length > remaining) {
                  setError(`이미지는 최대 ${maxImages}장까지입니다.`);
                } else {
                  setError('');
                }
                setBusy(true);
                void (async () => {
                  try {
                    const uploaded: string[] = [];
                    for (const file of batch) {
                      const resized = await resizeImageForUpload(file);
                      const result = await uploadImage('post', resized);
                      uploaded.push(result.url);
                    }
                    setImageUrls((prev) => [...prev, ...uploaded]);
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : '업로드 실패');
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            />
          </label>
          <button
            type="button"
            className="sranko-btn sranko-btn--ghost sranko-btn--sm"
            disabled={busy || imageUrls.length >= maxImages}
            onClick={openLookPicker}
          >
            룩에서 선택
          </button>
        </div>
      </div>
      {imageUrls.length > 0 ? (
        <SrankoImageCarousel
          urls={imageUrls}
          variant="compose"
          onRemoveAt={(index) => {
            setImageUrls((prev) => prev.filter((_, i) => i !== index));
          }}
        />
      ) : null}
      <div className="sranko-modal__actions">
        <Link className="sranko-btn sranko-btn--ghost" to={SRANKO_COMMUNITY}>
          취소
        </Link>
        <button
          type="button"
          className="sranko-btn sranko-btn--primary"
          disabled={busy || !subject.trim() || !content.trim() || imageUrls.length === 0}
          onClick={() => {
            if (imageUrls.length === 0) {
              return;
            }
            setBusy(true);
            setError('');
            void savePost({
              subject: subject.trim(),
              content: content.trim(),
              imageUrls,
            })
              .then((post) => {
                void navigate(`/hobbies/sranko/community/${post.id}`);
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : '작성 실패');
              })
              .finally(() => setBusy(false));
          }}
        >
          게시
        </button>
      </div>

      {lookPickerOpen ? (
        <Dialog
          open
          title="룩에서 선택"
          onClose={() => setLookPickerOpen(false)}
          closeOnBackdrop
          closeOnEscape
          backdropClassName="sranko-modal"
          panelClassName="sranko-modal__card sranko-modal__card--wide"
        >
          {({ titleId }) => (
            <>
              <h2 id={titleId}>룩에서 선택</h2>
              <p className="sranko-muted">
                남은 자리 {Math.max(0, maxImages - imageUrls.length)}장 · 선택한 룩 이미지를
                글에 추가합니다.
              </p>
              {pickerError ? <p className="sranko-error">{pickerError}</p> : null}
              {pickerLoading ? (
                <div className="sranko-empty">불러오는 중…</div>
              ) : pickerLooks.length === 0 ? (
                <div className="sranko-empty">선택할 룩이 없습니다.</div>
              ) : (
                <div className="sranko-look-picker-grid">
                  {pickerLooks.map((look) => {
                    const checked = pickerSelected.has(look.imageUrl);
                    const already = imageUrls.includes(look.imageUrl);
                    return (
                      <button
                        key={look.id}
                        type="button"
                        className={`sranko-look-picker-card${checked ? ' is-selected' : ''}${
                          already ? ' is-used' : ''
                        }`}
                        disabled={already}
                        onClick={() => togglePickerLook(look)}
                      >
                        <img src={look.imageUrl} alt="" />
                        <span>{look.name}</span>
                        {already ? <em>이미 추가됨</em> : null}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="sranko-modal__actions">
                <button
                  type="button"
                  className="sranko-btn sranko-btn--ghost"
                  onClick={() => setLookPickerOpen(false)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="sranko-btn sranko-btn--primary"
                  disabled={pickerSelected.size === 0}
                  onClick={applyLookPicker}
                >
                  {pickerSelected.size > 0
                    ? `${pickerSelected.size}장 추가`
                    : '추가'}
                </button>
              </div>
            </>
          )}
        </Dialog>
      ) : null}
    </section>
  );
}
