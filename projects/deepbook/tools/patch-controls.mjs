function disableInitializer(source, call) {
  const marker = `/* ${call} owned by the local accessible controller. */`;
  if (source.includes(marker)) return source;
  if (source.indexOf(call) < 0 || source.indexOf(call) !== source.lastIndexOf(call)) {
    throw new Error(`Expected one original ${call}`);
  }
  return source.replace(call, marker);
}

export function patchInteractionScript(source, url) {
  if (url.includes('/19933/59952.js')) {
    return disableInitializer(disableInitializer(source, 'initMobileDropdown();'), 'initGlobalTabDropdown();');
  }
  if (url.includes('/19933/60565.js')) {
    return disableInitializer(source, 'initDropdown();');
  }
  return source;
}
