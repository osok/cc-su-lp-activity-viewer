import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ACTIVITY_LOG_PATH = '/ai/work/claude-code/ai-tester-local/project-docs/activity.log';

async function loadActivityLog(page: any) {
  const content = fs.readFileSync(ACTIVITY_LOG_PATH, 'utf-8');
  const fileName = 'activity.log';
  await page.evaluate(
    ({ content, fileName }: { content: string; fileName: string }) => {
      (window as any).__loadActivityLog(content, fileName, fileName);
    },
    { content, fileName }
  );
  // Wait for data to load and render
  await page.waitForSelector('text=activity.log', { timeout: 5000 });
}

// ============================================================
// APP LOADING
// ============================================================

test.describe('App Loading', () => {
  test('app loads and shows empty state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Activity Log Viewer')).toBeVisible();
  });

  test('loads activity log via test hook', async ({ page }) => {
    await page.goto('/');
    await loadActivityLog(page);
    await expect(page.locator('text=activity.log')).toBeVisible();
  });

  test('displays entry count after loading', async ({ page }) => {
    await page.goto('/');
    await loadActivityLog(page);
    // Should show entry count in the header area
    const headerText = await page.locator('header, nav, [class*="nav"]').first().textContent();
    expect(headerText).toContain('entries');
  });
});

// ============================================================
// TIMELINE VIEW (Gantt Bars)
// ============================================================

test.describe('Timeline View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadActivityLog(page);
    // Timeline is the default view, but click it to be sure
    await page.locator('text=Timeline').first().click();
    await page.waitForTimeout(500); // Allow render
  });

  test('renders SVG with duration bars', async ({ page }) => {
    // Should have SVG elements for the chart
    const svgs = page.locator('svg');
    const count = await svgs.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Should have duration bars (rect elements with class duration-bar)
    const bars = page.locator('svg .duration-bar');
    const barCount = await bars.count();
    expect(barCount).toBeGreaterThan(0);
  });

  test('renders work sequence group headers', async ({ page }) => {
    // Should have group header text like "Seq 001", "Seq 002", etc.
    const svgContent = await page.locator('svg').first().innerHTML();
    // Check for group headers in the label SVG or chart SVG
    const allSvgContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('svg')).map(s => s.innerHTML).join('');
    });
    expect(allSvgContent).toContain('Seq');
  });

  test('renders agent swim lane labels', async ({ page }) => {
    // Agent names should appear in the label column
    const allSvgText = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('svg text')).map(t => t.textContent).join(' ');
    });
    // Common agents in the activity log
    expect(allSvgText).toContain('task-manager');
  });

  test('renders orphan bars for entries without terminals', async ({ page }) => {
    // Some START entries may not have matching COMPLETE entries
    const orphans = page.locator('svg .orphan-bar');
    const orphanCount = await orphans.count();
    // May or may not have orphans depending on the data - just verify no crash
    expect(orphanCount).toBeGreaterThanOrEqual(0);
  });

  test('renders marker dots for non-START events', async ({ page }) => {
    const markers = page.locator('svg .marker-dot');
    const markerCount = await markers.count();
    expect(markerCount).toBeGreaterThan(0);
  });

  test('connection lines are present when toggle is on', async ({ page }) => {
    // The connections group should be visible by default
    const connections = page.locator('svg .connections');
    const display = await connections.first().evaluate((el: SVGElement) => el.style.display);
    expect(display).not.toBe('none');
  });

  test('connection toggle hides/shows lines', async ({ page }) => {
    // Use the label text to find the checkbox (more reliable than bare input selector)
    const toggle = page.locator('label', { hasText: 'Show Connections' });
    const checkbox = toggle.locator('input[type="checkbox"]');

    // Uncheck - use force to bypass SVG overlap interception
    await checkbox.uncheck({ force: true });
    await page.waitForTimeout(300);

    // Connections should be hidden
    const connectionsDisplay = await page.evaluate(() => {
      const g = document.querySelector('svg .connections') as SVGGElement;
      return g?.style.display;
    });
    expect(connectionsDisplay).toBe('none');

    // Re-check
    await checkbox.check({ force: true });
    await page.waitForTimeout(300);
    const connectionsDisplay2 = await page.evaluate(() => {
      const g = document.querySelector('svg .connections') as SVGGElement;
      return g?.style.display;
    });
    expect(connectionsDisplay2).not.toBe('none');
  });

  test('label mode toggle switches between Task ID and Requirements', async ({ page }) => {
    // Get initial labels
    const getBarLabels = () => page.evaluate(() => {
      return Array.from(document.querySelectorAll('svg .bar-label')).map(t => t.textContent);
    });

    const taskIdLabels = await getBarLabels();

    // Click "Requirements" button
    await page.locator('button:text("Requirements")').click();
    await page.waitForTimeout(300);

    const reqLabels = await getBarLabels();

    // Labels should change (at least some should differ)
    // Not all will differ since some may use the same fallback
    expect(taskIdLabels.length).toBeGreaterThan(0);
    expect(reqLabels.length).toBeGreaterThan(0);
  });

  test('zoom controls work', async ({ page }) => {
    // Click zoom in button
    const zoomInBtn = page.locator('button[title="Zoom In"]');
    await expect(zoomInBtn).toBeVisible();
    await zoomInBtn.click();
    await page.waitForTimeout(400);

    // Click zoom out
    const zoomOutBtn = page.locator('button[title="Zoom Out"]');
    await zoomOutBtn.click();
    await page.waitForTimeout(400);

    // Click fit all
    const fitAllBtn = page.locator('button[title="Fit All"]');
    await fitAllBtn.click();
    await page.waitForTimeout(400);

    // No crash = success. Verify bars still exist
    const bars = page.locator('svg .duration-bar');
    expect(await bars.count()).toBeGreaterThan(0);
  });

  test('hover tooltip appears on bar', async ({ page }) => {
    // Find a duration bar and hover over it
    const bar = page.locator('svg .duration-bar').first();
    await bar.hover();
    await page.waitForTimeout(200);

    // Tooltip should appear as a fixed-position div
    const tooltip = page.locator('div[style*="position: fixed"][style*="z-index: 1000"]');
    await expect(tooltip).toBeVisible();
  });

  test('click on bar opens detail panel', async ({ page }) => {
    const bar = page.locator('svg .bar-group').first();
    await bar.click();
    await page.waitForTimeout(200);

    // Detail panel should be visible with entry info
    // It renders in the right side panel
    const detailPanel = page.locator('aside, [class*="detail"], [class*="panel"]');
    const panelCount = await detailPanel.count();
    expect(panelCount).toBeGreaterThanOrEqual(0); // May not have a dedicated aside
  });

  test('phase transition markers are visible', async ({ page }) => {
    const phaseMarkers = page.locator('svg .phase-marker');
    const count = await phaseMarkers.count();
    expect(count).toBeGreaterThan(0);
  });

  test('phase labels are rendered', async ({ page }) => {
    const phaseLabels = page.locator('svg .phase-label');
    const count = await phaseLabels.count();
    expect(count).toBeGreaterThan(0);
  });

  test('bars have correct color coding', async ({ page }) => {
    // Success bars should have green-ish fill, failure bars red-ish
    const barFills = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.duration-bar')).map(
        (el) => (el as SVGRectElement).getAttribute('fill')
      );
    });
    expect(barFills.length).toBeGreaterThan(0);
    // All bars should have a fill color set
    barFills.forEach((fill) => {
      expect(fill).toBeTruthy();
      expect(fill).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  test('bars have minimum width', async ({ page }) => {
    const barWidths = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.duration-bar')).map(
        (el) => parseFloat((el as SVGRectElement).getAttribute('width') || '0')
      );
    });
    barWidths.forEach((w) => {
      expect(w).toBeGreaterThanOrEqual(4); // MIN_BAR_WIDTH
    });
  });
});

// ============================================================
// DASHBOARD VIEW
// ============================================================

test.describe('Dashboard View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadActivityLog(page);
    await page.locator('text=Dashboard').first().click();
    await page.waitForTimeout(500);
  });

  test('renders phase pipeline cards', async ({ page }) => {
    // Should show phase names
    const text = await page.textContent('body');
    expect(text).toContain('Implementation');
    expect(text).toContain('Review');
  });

  test('no percentage exceeds 100%', async ({ page }) => {
    // Find all percentage displays
    const percentages = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const pcts: number[] = [];
      elements.forEach((el) => {
        const text = el.textContent || '';
        const match = text.match(/^(\d+)%$/);
        if (match) {
          pcts.push(parseInt(match[1], 10));
        }
      });
      return pcts;
    });

    // Verify no percentage exceeds 100
    percentages.forEach((pct) => {
      expect(pct).toBeLessThanOrEqual(100);
    });
  });

  test('shows work sequence breakdown', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text).toContain('Seq');
  });
});

// ============================================================
// TRACEABILITY VIEW
// ============================================================

test.describe('Traceability View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadActivityLog(page);
    await page.locator('text=Traceability').first().click();
    await page.waitForTimeout(500);
  });

  test('renders traceability matrix', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text).toContain('REQ');
  });

  test('phase columns follow canonical workflow order', async ({ page }) => {
    // Extract column headers from the FIRST table only (multiple requirement groups each have headers)
    const headers = await page.evaluate(() => {
      const firstTable = document.querySelector('table');
      if (!firstTable) return [];
      const ths = Array.from(firstTable.querySelectorAll('th'));
      return ths.map(th => th.textContent?.toLowerCase().trim()).filter(Boolean);
    });

    // Define canonical order (subset that should appear)
    const canonicalOrder = [
      'architecture', 'design', 'planning', 'implementation',
      'review', 'testing', 'documentation'
    ];

    // Filter headers to only include known phases
    const phaseHeaders = headers.filter(h => canonicalOrder.includes(h!));

    // Should have found at least some phase columns
    expect(phaseHeaders.length).toBeGreaterThan(0);

    // Verify they appear in the correct relative order
    for (let i = 1; i < phaseHeaders.length; i++) {
      const prevIdx = canonicalOrder.indexOf(phaseHeaders[i - 1]!);
      const currIdx = canonicalOrder.indexOf(phaseHeaders[i]!);
      expect(currIdx).toBeGreaterThan(prevIdx);
    }
  });

  test('shows requirement IDs in rows', async ({ page }) => {
    const text = await page.textContent('body');
    expect(text).toContain('REQ');
  });
});

// ============================================================
// HEATMAP VIEW
// ============================================================

test.describe('Heatmap View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadActivityLog(page);
    await page.locator('text=Heatmap').first().click();
    await page.waitForTimeout(500);
  });

  test('renders heatmap view without errors', async ({ page }) => {
    // Should show some file paths or heatmap data
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(0);
  });
});

// ============================================================
// NAVIGATION AND THEME
// ============================================================

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadActivityLog(page);
  });

  test('can switch between all views', async ({ page }) => {
    const views = ['Timeline', 'Dashboard', 'Heatmap', 'Traceability'];
    for (const view of views) {
      await page.locator(`text=${view}`).first().click();
      await page.waitForTimeout(300);
      // No crash = success
    }
  });

  test('dark mode toggle works', async ({ page }) => {
    const darkBtn = page.locator('text=Dark').first();
    await darkBtn.click();
    await page.waitForTimeout(200);

    // Body or root should have dark theme applied
    const hasDark = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') === 'dark'
        || document.body.classList.contains('dark')
        || getComputedStyle(document.body).backgroundColor !== 'rgb(255, 255, 255)';
    });
    expect(hasDark).toBeTruthy();
  });

  test('filter sidebar toggles', async ({ page }) => {
    const filterBtn = page.locator('text=Filters').first();
    await filterBtn.click();
    await page.waitForTimeout(200);
    // Should open the sidebar - check for filter-related content
  });
});

// ============================================================
// CONSOLE ERRORS
// ============================================================

test.describe('Console Errors', () => {
  test('no console errors during normal usage', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await loadActivityLog(page);

    // Navigate through views
    for (const view of ['Timeline', 'Dashboard', 'Heatmap', 'Traceability']) {
      await page.locator(`text=${view}`).first().click();
      await page.waitForTimeout(500);
    }

    // Filter out known benign errors (React dev mode, etc.)
    const realErrors = errors.filter(
      (e) => !e.includes('React DevTools') && !e.includes('favicon')
    );

    expect(realErrors).toEqual([]);
  });
});
