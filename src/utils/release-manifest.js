const RELEASE_CHANNEL_PRIORITY = {
  stable: 0,
  unstable: 1,
  beta: 2
};

export const getPlatformForOS = (platforms, osType) =>
  platforms.find(platform => platform.folder?.toUpperCase() === osType.toUpperCase());

export const getReleaseForPlatform = (platform, allowPrerelease) => {
  if (!platform?.releases?.length) {
    return null;
  }

  return [...platform.releases]
    .filter(release => release.channel !== 'beta' || allowPrerelease)
    .sort((left, right) => {
      const dateDifference = new Date(right.releaseDate) - new Date(left.releaseDate);
      if (dateDifference !== 0) {
        return dateDifference;
      }

      return (RELEASE_CHANNEL_PRIORITY[left.channel] ?? Number.MAX_SAFE_INTEGER) -
        (RELEASE_CHANNEL_PRIORITY[right.channel] ?? Number.MAX_SAFE_INTEGER);
    })[0] ?? null;
};

export const getPlatformsForChannel = (platforms, osTypes, allowPrerelease, channel) =>
  osTypes
    .map(osType => getPlatformForOS(platforms, osType))
    .filter(platform => getReleaseForPlatform(platform, allowPrerelease)?.channel === channel);

export const getPolicySources = (platforms, osTypes, allowPrerelease) =>
  osTypes.reduce((sources, osType) => {
    const platform = getPlatformForOS(platforms, osType);
    const release = getReleaseForPlatform(platform, allowPrerelease);
    const branch = release?.branch;

    if (!branch) {
      throw new Error(`No eligible documented release branch is available for ${osType}`);
    }

    sources[osType] = {
      branch,
      channel: release?.channel ?? 'default',
      name: release?.name ?? release?.version ?? branch
    };
    return sources;
  }, {});
