/**
 * 共享 CSS 样式
 */

export const COMMON_STYLES = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: #faf9f7;
  color: #1a1a1a;
  line-height: 1.7;
}
.container { max-width: 720px; margin: 0 auto; padding: 24px; }

/* Header */
header { text-align: center; padding: 48px 0 32px; border-bottom: 1px solid #e8e4dc; }
.site-name { font-size: 1.6em; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
.site-tagline { color: #6b6b6b; font-size: 0.95em; margin-bottom: 12px; }
nav { display: flex; justify-content: center; gap: 24px; margin-top: 20px; font-size: 0.9em; }
nav a { color: #6b6b6b; text-decoration: none; padding: 4px 8px; border-radius: 4px; transition: all 0.2s; }
nav a:hover { color: #1a1a1a; background: #f0ede6; }

/* Footer */
footer { text-align: center; padding: 40px 0 20px; border-top: 1px solid #e8e4dc; margin-top: 48px; color: #8b8b8b; font-size: 0.85em; }
footer a { color: #6b6b6b; text-decoration: none; }
footer a:hover { color: #1a1a1a; }
.footer-links { display: flex; justify-content: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
.footer-links a { padding: 4px 8px; }

/* Responsive */
@media (max-width: 600px) {
  .container { padding: 16px; }
  .site-name { font-size: 1.3em; }
}
`;

export const HOME_STYLES = `
${COMMON_STYLES}

/* Date Card */
.digests-list { margin-top: 40px; }
.digest-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  border: 1px solid #e8e4dc;
  transition: box-shadow 0.2s;
}
.digest-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.digest-date {
  font-size: 1.2em;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 4px;
}
.digest-meta {
  color: #8b8b8b;
  font-size: 0.85em;
  margin-bottom: 16px;
}
.digest-items { list-style: none; }
.digest-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f2eb;
}
.digest-item:last-child { border-bottom: none; }
.digest-number {
  font-size: 0.9em;
  font-weight: 700;
  color: #c9a959;
  min-width: 24px;
}
.digest-emoji { font-size: 1em; }
.digest-title {
  flex: 1;
  font-size: 0.95em;
  color: #3a3a3a;
  line-height: 1.5;
}
.digest-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 16px;
  color: #c9a959;
  font-size: 0.9em;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.2s;
}
.digest-link:hover { color: #1a1a1a; }
`;

export const DETAIL_STYLES = `
${COMMON_STYLES}

/* Digest List */
.digest-list { list-style: none; margin-top: 40px; }
.digest-item {
  display: flex;
  gap: 16px;
  padding: 24px 0;
  border-bottom: 1px solid #f0ede6;
  transition: background 0.2s;
}
.digest-item:hover { background: #faf9f7; }
.digest-number { font-size: 1.4em; font-weight: 700; color: #c9a959; min-width: 32px; text-align: right; }
.digest-content { flex: 1; }
.digest-title {
  font-size: 1.05em;
  font-weight: 600;
  margin-bottom: 8px;
  line-height: 1.5;
}
.digest-title a {
  color: #1a1a1a;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}
.digest-title a:hover { border-bottom-color: #c9a959; }
.digest-article {
  font-size: 0.95em;
  color: #4a4a4a;
  margin-bottom: 8px;
  line-height: 1.7;
}
.digest-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.82em;
  color: #8b8b8b;
  margin-top: 8px;
}
.digest-source { background: #f0ede6; padding: 2px 8px; border-radius: 4px; }
.digest-multi { color: #c9a959; font-weight: 500; }
.digest-score { color: #c9a959; font-weight: 600; }
.digest-category { background: #f5f2eb; padding: 2px 8px; border-radius: 4px; }
.digest-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.digest-tag { background: #f5f2eb; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; color: #6b6b6b; }

/* Priority Badge */
.priority-badge {
  display: inline-block;
  background: #c9a959;
  color: #fff;
  font-size: 0.75em;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 8px;
  font-weight: 600;
}

/* Section Divider */
.section-divider {
  margin: 32px 0;
  border: none;
  border-top: 2px solid #e8e4dc;
}
.section-title {
  font-size: 1.2em;
  font-weight: 700;
  color: #1a1a1a;
  margin: 24px 0 16px;
}

@media (max-width: 600px) {
  .digest-item { padding: 16px 0; gap: 12px; }
  .digest-number { font-size: 1.2em; min-width: 28px; }
  .digest-title { font-size: 1em; }
  .digest-meta { gap: 8px; }
}
`;

export const METHODOLOGY_STYLES = `
${COMMON_STYLES}

.content { margin-top: 40px; }
.content h2 { font-size: 1.4em; font-weight: 700; margin: 32px 0 16px; color: #1a1a1a; }
.content h3 { font-size: 1.1em; font-weight: 600; margin: 24px 0 12px; color: #3a3a3a; }
.content h4 { font-size: 1em; font-weight: 600; margin: 20px 0 8px; color: #4a4a4a; }
.content p { margin-bottom: 16px; color: #4a4a4a; }
.content ul { margin: 16px 0 16px 24px; color: #4a4a4a; }
.content li { margin-bottom: 8px; }
.content code { background: #f0ede6; padding: 2px 6px; border-radius: 4px; font-family: "SF Mono", Monaco, monospace; font-size: 0.9em; }
.content pre { background: #f5f2eb; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 16px 0; }
.content pre code { background: transparent; padding: 0; }

.table-wrapper { overflow-x: auto; margin: 16px 0; }
table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e8e4dc; }
th { background: #f5f2eb; font-weight: 600; }
.highlight { background: #fff9db; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 3px solid #c9a959; }
`;