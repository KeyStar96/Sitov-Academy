# Mobile pronunciation focus clearance

S5 epoch36 observed one native Help → Shift+Tab transition in Turkish, light/high contrast at390px where the focused inline recording button was covered by the returning fixed bottom navigation. Forward Tab and a second reverse transition were clear; the first observation remains a defect.

The pronunciation controls now reserve the existing full tabbar height plus1.5rem through mobile-only scroll-margin-block-end, including while the bar is hidden. Native focus scrolling can account for the returning bar without moving the layout, adding animation, or changing focus order. Desktop styles are unchanged.

Validation: git diff --check PASS. A fresh masked production build and native browser retest against the retained isolated PASS fixture are pending. This CSS change alone is not evidence that the observed defect is resolved. No microphone or physical recording success is claimed.
