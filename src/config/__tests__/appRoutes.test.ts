import { describe, it, expect } from 'vitest';
import { ROUTES } from '../appRoutes';

const findRoute = (path: string) => ROUTES.find((route) => route.path === path);

describe('appRoutes', () => {
  it('ensures every route path is unique', () => {
    const paths = ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('marks core premium routes with feature flags', () => {
    const premiumPaths = ['/ai-stories', '/wellness', '/sounds', '/recommendations', '/gamification', '/badges'];
    premiumPaths.forEach((path) => {
      const route = findRoute(path);
      expect(route?.feature).toBeTruthy();
    });
  });

  it('requires admin privileges for admin dashboards', () => {
    const adminPaths = ['/health-monitoring', '/admin/analytics-dashboard', '/admin/performance', '/admin/monitoring'];
    adminPaths.forEach((path) => {
      const route = findRoute(path);
      expect(route?.requireAdmin).toBe(true);
    });
  });

  it('provides CTA copy for every premium gate', () => {
    ROUTES.filter((route) => route.feature).forEach((route) => {
      expect(route.featureTitle).toBeTruthy();
    });
  });
});
