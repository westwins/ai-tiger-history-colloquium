# TRC Workbench v3.1.0 — Oracle Cloud & GitHub Sync Release (2026-11-18 SNU History Colloquium)

## Key Additions in v3.1.0 (Building on v3.0.0)
1. **Seonheul-1-ri Olle Museum Rainbow Memory & Sublimation Node (`HEAL-SEONHEUL-RAINBOW`)**:
   - Coordinates `33.514634, 126.693492` (Seonheul-1-ri, Jocheon-eup, Jeju, adjacent to Nakseondong 4·3 Fortress) in `backend/jeju43_comprehensive.json` and `frontend/data/jeju43_comprehensive.json` (`109` spatial records total).
   - Displays 90-year-old artist [Go Sun-ja's](https://www.socialmuseum.net/artists/7) ([Jejusori](https://www.jejusori.net/news/articleView.html?idxno=433158)) 2024 painting *〈아빠가 나를 사랑해〉* (`frontend/assets/gosunja-rainbow-2024.jpg`) alongside Jeju dialect inscription and historical context.
2. **Full-Stage Rainbow Epilogue Modal (`🌈 무지개 에필로그`, Shortcut `R`)**:
   - Accessible from the top bar, presenter bar, hero section, Cue Sheet (`12:57–13:00`), HGIS popup button, and keyboard shortcut `R`, pairing Go Sun-ja's rainbow painting with the Imjin River Civilian Control Line note *〈국토종단〉*.
3. **Container Build Fixes Preserved**:
   - `backend/Dockerfile` explicitly copies `jeju43_comprehensive.json`; `frontend/Dockerfile` copies `assets/` and `data/` cleanly without touching `trc-mariadb`.

## Safe Non-Destructive Oracle Deployment (`/home/ubuntu/trc`)
```sh
sudo python3 tools/deploy_colloquium_v31.py
```
