# CLAUDE.md — Mémoire du projet Retail Performer AI

Ce fichier est lu automatiquement par Claude Code à chaque session.
Il contient le contexte du projet, les décisions prises et les règles à appliquer.

---

## L'application

**Retail Performer AI** — SaaS de management retail assisté par IA
- **Stack** : React 19 + Vite (frontend) / FastAPI + MongoDB (backend)
- **Paiement** : Stripe
- **IA** : Google Generative AI (diagnostics DISC) + GPT-4o (analyse profils)
- **URL prod** : https://retailperformerai.com
- **Marché cible** : Gérants et managers de chaînes retail, marché français en priorité

**4 rôles utilisateurs** : Vendeur · Manager · Gérant · Super Admin

---

## Stratégie SEO — Décisions prises

### Mots-clés prioritaires (données Ubersuggest France)

| Mot-clé | Vol. FR/mois | KD SEO | Priorité |
|---|---|---|---|
| test disc | 5 400 | 44 | P2 (blog) |
| profil disc | 2 400 | 28 | **P1** |
| diagnostic disc | 500–1 200 | ~40 | **P1** |
| kpi retail | 170 | 26 | **P1** |
| intelligence artificielle retail | 30 | 13 | **P1** |
| gestion point de vente | 90 | 0 | SEA |

### Règles de rédaction SEO
- Le H1 doit contenir "KPI Retail" et/ou "Profil DISC"
- Le title tag suit le format : `[Bénéfice clé] | Retail Performer AI`
- Chaque page ou section importante doit cibler au moins un mot-clé à volume
- Éviter "logiciel point de vente" (trop compétitif, KD 65+)
- L'angle DISC est le **différenciateur unique** — aucun concurrent ne combine DISC + KPI retail

### Outil SEO utilisé : **Ubersuggest**

---

## Landing Page — Architecture et décisions

### Ordre des sections
1. BannerSection — programme pilote
2. HeaderSection — navigation
3. HeroSection — hero principal
4. SocialProofSection — preuve sociale
5. ProblemSolutionSection — problème / solution
6. **DiscSection** *(ajoutée)* — diagnostic DISC retail
7. FeaturesSection — fonctionnalités
8. ScreenshotsSection — dashboards
9. PricingSection — tarifs
10. FaqSection — FAQ
11. CtaSection — CTA final
12. ContactSection — contact / démo Calendly
13. FooterSection

### CTAs démo — Décisions de placement

**Deux types de démo distincts :**
- `LiveDemoModal` → "Explorer la démo" — self-serve, sans inscription, choix du rôle (Gérant/Manager/Vendeur)
- `DemoModal` → "Demander une démo" — Calendly, RDV 30 min avec le fondateur

**Règle** : "Explorer la démo" = haut de funnel (curiosité, zéro friction)
**Règle** : "Demander une démo" = bas de funnel (décideur prêt à s'engager)

**Placements validés :**
| Section | Explorer la démo | Demander une démo |
|---|---|---|
| HeroSection | ✅ bouton secondaire | — |
| ScreenshotsSection | ✅ après les 3 dashboards | — |
| PricingSection | ✅ ligne "Pas encore convaincu ?" | ✅ ligne "Pas encore convaincu ?" |
| CtaSection | ✅ bouton secondaire | — |
| ContactSection | — | ✅ bouton principal |

**Règle** : Ne pas remplacer "Explorer la démo" par "Demander une démo" dans le Hero — trop de friction pour un visiteur qui découvre.

---

## Système DISC — Ce que l'app fait réellement

### Deux diagnostics distincts
- **Vendeur** : 39 questions (15 compétences vente + 24 DISC) → style parmi 5, niveau, motivation, scores sur 5 piliers
- **Manager** : 35 questions (15 management + 20 DISC) → profil parmi 7, 2 forces, axe de progression

### Les 4 profils DISC
- **D** Dominant — Rouge — Direct, décisif, orienté résultats
- **I** Influent — Jaune — Enthousiaste, sociable, expressif
- **S** Stable — Vert — Patient, loyal, coopératif
- **C** Consciencieux — Bleu — Précis, analytique, méthodique

### Les 5 styles vendeur retail
Le Convivial (I) · L'Explorateur (I/S) · Le Dynamique (D) · Le Discret (S) · Le Stratège (C)

### Les 7 profils manager
Le Pilote · Le Coach · Le Stratège · Le Dynamiseur · Le Facilitateur · Le Tacticien · Le Mentor

### Les 4 motivations
Relation · Reconnaissance · Performance · Découverte

### Les 4 niveaux de progression
Nouveau Talent → Challenger → Ambassadeur → Maître du Jeu

### Matrice de compatibilité
Manager × Vendeur — conseils de communication adaptés selon les profils DISC croisés.

---

## Règles à appliquer après chaque modification

1. **Commit clair** avec message en anglais, format : `feat|fix|docs|refactor(scope): description`
2. **Push sur les 2 environnements** (origin + production quand configuré)
3. **Mettre à jour ce fichier CLAUDE.md** si une nouvelle décision structurante est prise
4. **Ne pas toucher** aux mots-clés du H1 (`KPI Retail`, `Profil DISC`) sans discussion préalable
5. **Ne pas déplacer** les CTAs démo sans discussion préalable — les placements sont validés
6. **Conserver l'ordre des sections** de la landing page sauf instruction contraire

---

## Marché & Concurrence

| Concurrent | Forces | Ce qui manque |
|---|---|---|
| Skello (€47M) | Planning équipe, SEO fort | Pas de KPI analytics ni DISC |
| Combo (€40M) | Logiciel commerce détail | Pas de performance analytics |
| Orquest | KPI retail, suivi KPI | Workforce planning, pas DISC |
| Cegid | POS, gestion retail | ERP/POS, pas RH analytics |
| Everything DiSC | Test DISC global | Évaluation seule, pas de KPI retail |

**White space** : Aucun concurrent ne combine DISC + KPI retail + analytics multi-magasins.

---

## Tarification

- **Small Team** (1–5 vendeurs) : 19€/vendeur/mois (tarif fondateur, barré à 29€)
- **Medium Team** (6–15 vendeurs) : 15€/vendeur/mois (barré à 25€)
- **Large Team** (16+) : Sur devis
- Espace Gérant & Manager inclus dans toutes les formules
- Programme Pilote : 5 prochains magasins partenaires, tarif bloqué à vie
