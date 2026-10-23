# Feuille de match basket

Tableau de score pour un match de basket : deux équipes, points (+1 / +2 / +3), fautes, temps-morts, quart-temps, chrono de match, horloge des 24 secondes et historique des actions.

## Utiliser sans rien installer

Double-clic sur `index.html` : la page s'ouvre dans le navigateur.
Le match est sauvegardé automatiquement dans le navigateur (il reste là si tu fermes la page).

## Raccourcis clavier

| Touche | Action |
|---|---|
| Espace | Lancer / arrêter le chrono |
| `R` | Remettre les 24 s |
| `Z` | Annuler la dernière action |
| `1` `2` `3` | Points pour l'équipe à domicile |
| `7` `8` `9` | +1 / +2 / +3 pour l'équipe visiteuse |

## Modifier

Noms des équipes : clic sur le nom pour l'écrire.
Durée d'un quart-temps : constante `QUARTER_MINUTES` en haut de `index.js`.
Couleurs : variables en haut de `index.css`.

## Avec Vite (optionnel, nécessite Node.js)

```bash
npm install
npm run dev
```

`npm run build` produit une version prête à mettre en ligne dans `dist/`.

Have fun with coding!