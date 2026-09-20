export function isNormalLeftClick(event) {
  return event.button === 0
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.shiftKey;
}

export function isOutsideDisclosure(target, { trigger, panel }) {
  return !trigger?.contains(target) && !panel?.contains(target);
}

export function dismissTopDisclosureOnEscape(event, disclosures) {
  if (event.key !== 'Escape') {
    return false;
  }

  const disclosure = disclosures.find(({ open }) => open);
  if (!disclosure) {
    return false;
  }

  disclosure.close();
  disclosure.trigger?.focus();
  return true;
}
