# ✈️ Aéro Tycoon

Un jeu de gestion d'aéroport / compagnie aérienne, jouable directement dans le navigateur.
**Aucune installation nécessaire.**

## Comment jouer

1. Ouvre le fichier **`index.html`** (double-clic) dans ton navigateur.
2. Va dans **🏪 Marché des avions** et achète un avion.
3. Va dans **🗺️ Lignes**, choisis deux villes, fixe un prix de billet, ouvre la ligne.
4. Assigne ton avion à la ligne (menu déroulant de la ligne).
5. Clique sur **▶ Passer au jour suivant** pour faire tourner la compagnie et voir les résultats.

## Objectif

Gagner de l'argent en transportant un maximum de voyageurs, tout en gardant ta
trésorerie positive et ta réputation haute.

## Les fichiers

| Fichier      | Rôle                                                        |
|--------------|-------------------------------------------------------------|
| `index.html` | La structure de la page (le squelette).                     |
| `style.css`  | L'apparence (couleurs, mise en page).                       |
| `game.js`    | Toutes les règles du jeu (le cerveau), abondamment commenté.|

## Feuille de route

- **Partie 1** : argent, avions, lignes, simulation jour par jour, usure, réputation.
- **Partie 2 (actuelle)** : économie approfondie — prêts bancaires et intérêts, agrandissement
  de l'aéroport (portes = avions simultanés), personnel (pilotes, mécaniciens, agents au sol),
  réparation des avions, sauvegarde/chargement de la partie. Correction de l'élasticité des prix
  (un billet trop cher fait fuir tous les voyageurs).
- **Partie 3 (à venir)** : demandes/contrats des usagers, événements aléatoires (météo, pannes,
  grèves), concurrence.

## Mémo des règles économiques (Partie 2)

- **Pilotes** : il faut 4 pilotes par avion en service. Pas assez = avions cloués au sol.
- **Portes de l'aéroport** : limitent le nombre d'avions volant en même temps. Agrandir = plus de portes.
- **Mécaniciens** : réduisent l'usure et les coûts d'entretien (jusqu'à −40 %).
- **Agents au sol** : captent davantage de voyageurs (jusqu'à +30 %).
- **Banque** : emprunter rapporte un capital immédiat mais coûte des intérêts chaque jour.
- **Prix du billet** : au-delà d'environ 3,5× le prix conseillé, plus personne ne voyage.
