# Mobile pronunciation focus clearance

S5 epoch36 observed one native Help → Shift+Tab transition in Turkish, light/high contrast at390px where the focused inline recording button was covered by the returning fixed bottom navigation. Forward Tab and a second reverse transition were clear; the first observation remains a defect.

The pronunciation controls now reserve the existing full tabbar height plus1.5rem through mobile-only scroll-margin-block-end, including while the bar is hidden. Native focus scrolling can account for the returning bar without moving the layout, adding animation, or changing focus order. Desktop styles are unchanged.

Validation: git diff --check PASS. A fresh masked production build and native browser retest against the retained isolated PASS fixture are pending. This CSS change alone is not evidence that the observed defect is resolved. No microphone or physical recording success is claimed.

Verified follow-up: masked production Webpack build exit0, BUILD_ID XLm2trsHZX8ZGja1yykY-. S5 epoch37 ran four native reverse-focus sequences and forward focus at TR390/light/high, including visible navigation; smallest visible clearance34.0625px. Thirteen900ms observations were stationary before/after screenshots. Authentic macOS reduced motion produced real browser matchMedia true and three usable focus sequences, then was restored off/false. M independently checked geometry and two actual screenshots. Scope is those observed flows, not physical recording or a complete motion audit. Original S5 evidence is preserved in commit76b257a375ae29a0f16e3f8e8d0e9e80798bffed.
