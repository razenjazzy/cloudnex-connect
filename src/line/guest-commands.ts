/** Commands an unverified LINE user may run (browse catalog; quote/order still need VERIFY). */
export const isGuestAllowedCommand = (upperText: string, pendingFlow?: { flow: string }): boolean => {
  if (pendingFlow?.flow === 'VERIFY' || pendingFlow?.flow === 'PRODUCT_FIND') return true;
  if (upperText === 'NAV HOME' || upperText === 'NAV' || upperText === 'BACK') return true;
  if (upperText === 'NAV COMMERCE' || upperText === 'NAV CATALOG') return true;
  if (upperText === 'NAV VERIFY' || upperText.startsWith('FORM VERIFY') || upperText.startsWith('VERIFY ')) return true;
  if (upperText === 'FORM PRODUCT FIND' || upperText.startsWith('PRODUCT FIND')) return true;
  if (upperText === 'SERVICE LIST' || upperText.startsWith('SERVICE LIST ')) return true;
  if (upperText === 'LANG' || upperText.startsWith('LANG ') || upperText === 'ENGLISH' || upperText === 'THAI' || upperText === 'ภาษาไทย') return true;
  if (upperText === 'GUIDE' || upperText.startsWith('GUIDE ')) return true;
  if (upperText === 'MY DATA' || upperText === 'DELETE MY DATA') return true;
  if (upperText === 'START' || upperText === 'HELP' || upperText === 'OPTIONS' || upperText === 'MENU' || upperText === 'เริ่มต้น') return true;
  return false;
};
