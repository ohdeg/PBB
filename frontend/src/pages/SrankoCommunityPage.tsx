import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SRANKO_COMMUNITY_MINE,
  SRANKO_COMMUNITY_NEW,
} from '../features/sranko/paths';
import {
  postImageUrls,
  SrankoImageCarousel,
} from '../features/sranko/SrankoImageCarousel';
import { useSrankoPosts } from '../features/sranko/useSrankoStore';
import { useAuthStore } from '../stores/authStore';

type SortMode = 'new' | 'view';

function formatPostMeta(post: {
  readCount: number;
  likeCount: number;
  commentCount: number;
}): string {
  return `조회 ${post.readCount} · 좋아요 ${post.likeCount} · 댓글 ${post.commentCount}`;
}

export function SrankoCommunityPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [sort, setSort] = useState<SortMode>('new');
  const { posts, loading, error } = useSrankoPosts(sort);

  return (
    <section className="sranko-panel">
      <div className="sranko-panel__head">
        <div>
          <h1>커뮤니티</h1>
          <p className="sranko-panel__lede">스타일을 공유해 보세요.</p>
        </div>
        <div className="sranko-tabs">
          <button
            type="button"
            className={sort === 'new' ? 'is-active' : undefined}
            onClick={() => setSort('new')}
          >
            최신
          </button>
          <button
            type="button"
            className={sort === 'view' ? 'is-active' : undefined}
            onClick={() => setSort('view')}
          >
            조회
          </button>
        </div>
      </div>

      {error ? <p className="sranko-error">{error}</p> : null}
      {loading ? (
        <div className="sranko-empty">불러오는 중…</div>
      ) : posts.length === 0 ? (
        <div className="sranko-empty">아직 게시글이 없습니다.</div>
      ) : (
        <div className="sranko-grid">
          {posts.map((post) => (
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
                <span>
                  {post.authorNickname} · {formatPostMeta(post)}
                </span>
              </Link>
            </article>
          ))}
        </div>
      )}

      <p className="sranko-footer-links">
        {accessToken ? (
          <>
            <Link className="sranko-link" to={SRANKO_COMMUNITY_NEW}>
              글쓰기
            </Link>
            {' · '}
            <Link className="sranko-link" to={SRANKO_COMMUNITY_MINE}>
              MY STYLE
            </Link>
          </>
        ) : (
          <Link
            className="sranko-link"
            to="/login"
            state={{ from: '/hobbies/sranko/community' }}
          >
            로그인하고 글쓰기
          </Link>
        )}
      </p>
    </section>
  );
}
