import { type RenovateConfig, partial } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import type { BranchUpgradeConfig } from '../../types.ts';
import * as _changelog from '../changelog/index.ts';
import { branchifyUpgrades } from './branchify.ts';
import * as _flatten from './flatten.ts';

const flattenUpdates = vi.mocked(_flatten).flattenUpdates;
const embedChangelogs = vi.mocked(_changelog).embedChangelogs;

vi.mock('./flatten.ts');
vi.mock('../changelog/index.ts');

let config: RenovateConfig;

beforeEach(() => {
  config = getConfig();
  config.errors = [];
  config.warnings = [];
});

describe('workers/repository/updates/branchify', () => {
  describe('branchifyUpgrades()', () => {
    it('returns empty', async () => {
      flattenUpdates.mockResolvedValueOnce([]);
      const res = await branchifyUpgrades(config, {});
      expect(res.branches).toBeEmptyArray();
    });

    it('returns one branch if one input', async () => {
      flattenUpdates.mockResolvedValueOnce(
        partial<BranchUpgradeConfig>([
          {
            depName: 'foo',
            branchName: 'foo-{{version}}',
            version: '1.1.0',
            prTitle: 'some-title',
            updateType: 'minor',
            packageFile: 'foo/package.json',
          },
        ]),
      );
      config.repoIsOnboarded = true;
      const res = await branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(1);
    });

    it('deduplicates', async () => {
      flattenUpdates.mockResolvedValueOnce(
        partial<BranchUpgradeConfig>([
          {
            depName: 'foo',
            branchName: 'foo-{{version}}',
            currentValue: '1.1.0',
            newValue: '1.3.0',
            prTitle: 'some-title',
            updateType: 'minor',
            packageFile: 'foo/package.json',
          },
          {
            depName: 'foo',
            branchName: 'foo-{{version}}',
            currentValue: '1.1.0',
            newValue: '1.2.0',
            prTitle: 'some-title',
            updateType: 'minor',
            packageFile: 'foo/package.json',
          },
        ]),
      );
      config.repoIsOnboarded = true;
      const res = await branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(1);
    });

    it('groups if same compiled branch names', async () => {
      flattenUpdates.mockResolvedValueOnce(
        partial<BranchUpgradeConfig>([
          {
            depName: 'foo',
            branchName: 'foo',
            version: '1.1.0',
            prTitle: 'some-title',
          },
          {
            depName: 'foo',
            branchName: 'foo',
            version: '2.0.0',
            prTitle: 'some-title',
          },
          {
            depName: 'bar',
            branchName: 'bar-{{version}}',
            version: '1.1.0',
            prTitle: 'some-title',
          },
        ]),
      );
      const res = await branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(2);
    });

    it('groups if same compiled group name', async () => {
      flattenUpdates.mockResolvedValueOnce(
        partial<BranchUpgradeConfig>([
          {
            depName: 'foo',
            branchName: 'foo',
            prTitle: 'some-title',
            version: '1.1.0',
            groupName: 'My Group',
            group: { branchName: 'renovate/{{groupSlug}}' },
          },
          {
            depName: 'foo',
            branchName: 'foo',
            prTitle: 'some-title',
            version: '2.0.0',
          },
          {
            depName: 'bar',
            branchName: 'bar-{{version}}',
            prTitle: 'some-title',
            version: '1.1.0',
            groupName: 'My Group',
            group: { branchName: 'renovate/my-group' },
          },
        ]),
      );
      const res = await branchifyUpgrades(config, {});
      expect(Object.keys(res.branches)).toHaveLength(2);
    });

    it('no fetch changelogs', async () => {
      config.fetchChangeLogs = 'off';
      flattenUpdates.mockResolvedValueOnce(
        partial<BranchUpgradeConfig>([
          {
            depName: 'foo',
            branchName: 'foo',
            prTitle: 'some-title',
            version: '1.1.0',
            groupName: 'My Group',
            group: { branchName: 'renovate/{{groupSlug}}' },
          },
          {
            depName: 'foo',
            branchName: 'foo',
            prTitle: 'some-title',
            version: '2.0.0',
          },
          {
            depName: 'bar',
            branchName: 'bar-{{version}}',
            prTitle: 'some-title',
            version: '1.1.0',
            groupName: 'My Group',
            group: { branchName: 'renovate/my-group' },
          },
        ]),
      );
      const res = await branchifyUpgrades(config, {});
      expect(embedChangelogs).not.toHaveBeenCalled();
      expect(Object.keys(res.branches)).toHaveLength(2);
    });

    it('expands security groups with package-group peers', async () => {
      config.repoIsOnboarded = true;
      config.vulnerabilityAlerts = {
        ...config.vulnerabilityAlerts,
        groupName: 'security',
        expandPackageGroups: true,
      };
      flattenUpdates.mockResolvedValueOnce(
        partial<BranchUpgradeConfig>([
          {
            depName: 'A',
            branchName: 'renovate/security',
            groupName: 'security',
            vulnerabilityPackageGroupName: 'group-a',
            isVulnerabilityAlert: true,
            currentValue: '1.0.0',
            newValue: '1.1.0',
            updateType: 'minor',
            packageFile: 'package.json',
            prTitle: 'some-title',
          },
          {
            depName: 'B',
            branchName: 'renovate/security',
            groupName: 'security',
            vulnerabilityPackageGroupName: 'group-b',
            isVulnerabilityAlert: true,
            currentValue: '1.0.0',
            newValue: '1.1.0',
            updateType: 'minor',
            packageFile: 'package.json',
            prTitle: 'some-title',
          },
          {
            depName: 'A1',
            branchName: 'renovate/group-a',
            groupName: 'group-a',
            currentValue: '1.0.0',
            newValue: '1.1.0',
            updateType: 'minor',
            packageFile: 'package.json',
            prTitle: 'some-title',
          },
          {
            depName: 'A2',
            branchName: 'renovate/group-a',
            groupName: 'group-a',
            currentValue: '1.0.0',
            newValue: '1.1.0',
            updateType: 'minor',
            packageFile: 'package.json',
            prTitle: 'some-title',
          },
        ]),
      );

      const res = await branchifyUpgrades(config, {});
      const securityBranch = res.branches.find(
        (branch) => branch.branchName === 'renovate/security',
      );
      expect(
        securityBranch?.upgrades.map((upgrade) => upgrade.depName),
      ).toEqual(expect.arrayContaining(['A', 'B', 'A1', 'A2']));
    });

    it('does not expand security groups unless enabled', async () => {
      config.repoIsOnboarded = true;
      config.vulnerabilityAlerts = {
        ...config.vulnerabilityAlerts,
        groupName: 'security',
        expandPackageGroups: false,
      };
      flattenUpdates.mockResolvedValueOnce(
        partial<BranchUpgradeConfig>([
          {
            depName: 'A',
            branchName: 'renovate/security',
            groupName: 'security',
            vulnerabilityPackageGroupName: 'group-a',
            isVulnerabilityAlert: true,
            currentValue: '1.0.0',
            newValue: '1.1.0',
            updateType: 'minor',
            packageFile: 'package.json',
            prTitle: 'some-title',
          },
          {
            depName: 'A1',
            branchName: 'renovate/group-a',
            groupName: 'group-a',
            currentValue: '1.0.0',
            newValue: '1.1.0',
            updateType: 'minor',
            packageFile: 'package.json',
            prTitle: 'some-title',
          },
        ]),
      );

      const res = await branchifyUpgrades(config, {});
      const securityBranch = res.branches.find(
        (branch) => branch.branchName === 'renovate/security',
      );
      expect(
        securityBranch?.upgrades.map((upgrade) => upgrade.depName),
      ).toEqual(['A']);
    });

    it('does not expand when vulnerability groupName is unset', async () => {
      config.repoIsOnboarded = true;
      config.vulnerabilityAlerts = {
        ...config.vulnerabilityAlerts,
        groupName: undefined,
        expandPackageGroups: true,
      };
      flattenUpdates.mockResolvedValueOnce(
        partial<BranchUpgradeConfig>([
          {
            depName: 'A',
            branchName: 'renovate/a-vulnerability',
            vulnerabilityPackageGroupName: 'group-a',
            isVulnerabilityAlert: true,
            currentValue: '1.0.0',
            newValue: '1.1.0',
            updateType: 'minor',
            packageFile: 'package.json',
            prTitle: 'some-title',
          },
          {
            depName: 'A1',
            branchName: 'renovate/group-a',
            groupName: 'group-a',
            currentValue: '1.0.0',
            newValue: '1.1.0',
            updateType: 'minor',
            packageFile: 'package.json',
            prTitle: 'some-title',
          },
        ]),
      );

      const res = await branchifyUpgrades(config, {});
      expect(
        res.branches.find((branch) => branch.branchName === 'renovate/group-a'),
      ).toBeDefined();
      expect(
        res.branches.find(
          (branch) => branch.branchName === 'renovate/a-vulnerability',
        ),
      ).toBeDefined();
    });
  });
});
