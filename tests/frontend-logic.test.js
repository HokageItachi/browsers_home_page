const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  SEARCH_ENGINES,
  resolveSearchTarget,
  getSortedSites,
  escapeHtml
} = require('../public/js/app');

describe('Frontend Pure Logic & Security Unit Tests', () => {

  test('Search Routing: Default Google search', () => {
    const target = resolveSearchTarget('javascript async await', 'google');
    assert.equal(target, 'https://www.google.com/search?q=javascript%20async%20await');
  });

  test('Search Routing: DuckDuckGo search', () => {
    const target = resolveSearchTarget('privacy browser', 'duckduckgo');
    assert.equal(target, 'https://duckduckgo.com/?q=privacy%20browser');
  });

  test('Search Shortcuts: !g routes to Google', () => {
    const target = resolveSearchTarget('!g deep learning');
    assert.equal(target, 'https://www.google.com/search?q=deep%20learning');
  });

  test('Search Shortcuts: !d and !ddg route to DuckDuckGo', () => {
    assert.equal(resolveSearchTarget('!d open source'), 'https://duckduckgo.com/?q=open%20source');
    assert.equal(resolveSearchTarget('!ddg privacy'), 'https://duckduckgo.com/?q=privacy');
  });

  test('Search Shortcuts: !y and !yt route to YouTube', () => {
    assert.equal(resolveSearchTarget('!y lofi beats'), 'https://www.youtube.com/results?search_query=lofi%20beats');
    assert.equal(resolveSearchTarget('!yt jazz music'), 'https://www.youtube.com/results?search_query=jazz%20music');
  });

  test('Search Shortcuts: !gh routes to GitHub', () => {
    const target = resolveSearchTarget('!gh express');
    assert.equal(target, 'https://github.com/search?q=express');
  });

  test('Search Shortcuts: !r routes to Reddit', () => {
    const target = resolveSearchTarget('!r programming');
    assert.equal(target, 'https://www.reddit.com/search/?q=programming');
  });

  test('Search Shortcuts: !w and !wiki route to Wikipedia', () => {
    assert.equal(resolveSearchTarget('!w Quantum computing'), 'https://en.wikipedia.org/wiki/Special:Search?search=Quantum%20computing');
  });

  test('Search Shortcuts: !br routes to Brave', () => {
    assert.equal(resolveSearchTarget('!br rust lang'), 'https://search.brave.com/search?q=rust%20lang');
  });

  test('URL Detection: Direct domains auto-prepend https://', () => {
    assert.equal(resolveSearchTarget('github.com'), 'https://github.com');
    assert.equal(resolveSearchTarget('www.reddit.com'), 'https://www.reddit.com');
    assert.equal(resolveSearchTarget('http://localhost:3000'), 'http://localhost:3000');
    assert.equal(resolveSearchTarget('localhost:8080'), 'https://localhost:8080');
  });

  test('URL Detection: Queries with spaces are NOT treated as URLs', () => {
    const target = resolveSearchTarget('hello world.com is cool', 'google');
    assert.equal(target, 'https://www.google.com/search?q=hello%20world.com%20is%20cool');
  });

  test('XSS Protection: escapeHtml correctly encodes malicious markup', () => {
    const malicious = '<script>alert("XSS & exploit")</script>';
    const escaped = escapeHtml(malicious);
    assert.ok(!escaped.includes('<script>'));
    assert.ok(escaped.includes('&lt;script&gt;'));
    assert.ok(escaped.includes('&quot;'));
    assert.ok(escaped.includes('&amp;'));
  });

  test('Sites Sorting: Pinned sites always appear first, followed by highest visits', () => {
    const sampleSites = [
      { id: '1', title: 'Low visits', visits: 2, pinned: false },
      { id: '2', title: 'High visits', visits: 50, pinned: false },
      { id: '3', title: 'Pinned site', visits: 10, pinned: true }
    ];

    const sorted = getSortedSites(sampleSites, true);
    assert.equal(sorted[0].id, '3', 'Pinned site must be index 0');
    assert.equal(sorted[1].id, '2', '50 visits site must be index 1');
    assert.equal(sorted[2].id, '1', '2 visits site must be index 2');
  });

  test('Sites Sorting: Default/Manual mode preserves order', () => {
    const sampleSites = [
      { id: 'a', title: 'A', visits: 10, pinned: false },
      { id: 'b', title: 'B', visits: 100, pinned: false }
    ];
    const sorted = getSortedSites(sampleSites, false);
    assert.equal(sorted[0].id, 'a');
    assert.equal(sorted[1].id, 'b');
  });
});
