/* =====================================================================
   AÉRO TYCOON — LE CERVEAU DU JEU (game.js)
   =====================================================================
   Ce fichier contient TOUTES les règles du jeu. Il est découpé en
   grandes sections faciles à retrouver :

     1. LES DONNÉES DE DÉPART  (villes, modèles d'avions)
     2. L'ÉTAT DU JEU          (l'argent, les avions possédés, etc.)
     3. LES OUTILS DE CALCUL   (distance, demande, prix conseillé...)
     4. LES ACTIONS DU JOUEUR  (acheter, créer une ligne, etc.)
     5. LA SIMULATION          (ce qui se passe quand un jour passe)
     6. L'AFFICHAGE            (dessiner les pages à l'écran)
     7. LE DÉMARRAGE           (brancher les boutons et lancer le jeu)

   Vocabulaire utile :
   - une "variable" = une boîte qui retient une valeur (ex : argent = 8000000)
   - un "objet"     = une fiche avec plusieurs infos { nom: "...", prix: 10 }
   - un "tableau"   = une liste d'objets [ fiche1, fiche2, fiche3 ]
   - une "fonction" = une recette réutilisable qui fait une tâche
   ===================================================================== */


/* =====================================================================
   1. LES DONNÉES DE DÉPART
   ===================================================================== */

/* Les villes desservables. x et y sont des coordonnées fictives sur une
   carte : elles servent UNIQUEMENT à calculer les distances.
   "trafic" (de 1 à 10) = à quel point la ville attire des voyageurs.
   Une grande capitale a un gros trafic, une petite ville un petit. */
const VILLES = [
  { nom: "Paris",      x: 50,  y: 60,  trafic: 10 },
  { nom: "Londres",    x: 40,  y: 45,  trafic: 9  },
  { nom: "Madrid",     x: 30,  y: 110, trafic: 7  },
  { nom: "Rome",       x: 95,  y: 105, trafic: 7  },
  { nom: "Berlin",     x: 105, y: 40,  trafic: 8  },
  { nom: "New York",   x: -180,y: 75,  trafic: 10 },
  { nom: "Dubaï",      x: 230, y: 130, trafic: 8  },
  { nom: "Tokyo",      x: 430, y: 70,  trafic: 9  },
  { nom: "Marrakech",  x: 10,  y: 150, trafic: 5  },
  { nom: "Reykjavik",  x: 5,   y: 5,   trafic: 3  },
];

/* Le catalogue des modèles d'avions qu'on peut acheter au marché.
   - capacite     : nombre de sièges
   - rayon        : distance maximale qu'il peut parcourir (en km)
   - vitesse      : en km/h (sert à savoir combien de vols par jour)
   - conso        : coût du carburant en € par km parcouru
   - maintenance  : coût fixe d'entretien par jour, même au sol
   - prix         : prix d'achat */
const MODELES = [
  { id: "regional", nom: "TurboProp 80", capacite: 80,  rayon: 2000,  vitesse: 600, conso: 4,  maintenance: 1500, prix: 4000000 },
  { id: "moyen",    nom: "JetLiner 180", capacite: 180, rayon: 6500,  vitesse: 850, conso: 7,  maintenance: 3000, prix: 9000000 },
  { id: "gros",     nom: "SkyGiant 380", capacite: 380, rayon: 14000, vitesse: 900, conso: 13, maintenance: 7000, prix: 20000000 },
];

/* ---- ÉCONOMIE : aéroport, personnel, banque ----------------------- */

/* Les niveaux d'aéroport. "portes" = nombre maximum d'avions pouvant
   opérer EN MÊME TEMPS. Pour faire voler plus d'avions, il faut agrandir.
   "coutJournalier" = frais de fonctionnement fixes chaque jour. */
const AEROPORT_NIVEAUX = [
  { nom: "Aérodrome",             portes: 2,  coutJournalier: 2000,  prixAmelioration: 0 },
  { nom: "Aéroport régional",     portes: 4,  coutJournalier: 5000,  prixAmelioration: 8000000 },
  { nom: "Aéroport international", portes: 8,  coutJournalier: 12000, prixAmelioration: 25000000 },
  { nom: "Hub mondial",           portes: 16, coutJournalier: 30000, prixAmelioration: 60000000 },
];

/* Salaires journaliers de chaque métier. */
const SALAIRES = { pilote: 500, mecanicien: 400, agent: 250 };

/* Il faut un équipage complet (pilotes + copilotes qui se relaient) par
   avion en service. */
const EQUIPAGE_PAR_AVION = 4;

/* Banque : intérêt prélevé chaque jour sur la dette, et plafond d'emprunt. */
const TAUX_INTERET_JOUR = 0.0005;   // 0,05 %/jour, soit ~20 %/an
const DETTE_MAX = 80000000;

/* Clé utilisée pour sauvegarder la partie dans le navigateur. */
const CLE_SAUVEGARDE = "aeroTycoonSauvegarde";


/* =====================================================================
   2. L'ÉTAT DU JEU
   ---------------------------------------------------------------------
   "etat" est l'objet unique qui retient TOUT ce qui change pendant la
   partie. Si on voulait sauvegarder la partie, il suffirait de sauver
   cet objet. On y reviendra dans une prochaine partie.
   ===================================================================== */
/* "etatInitial()" fabrique un état tout neuf. On en fait une fonction pour
   pouvoir recommencer une partie (bouton « Nouvelle partie »). */
function etatInitial() {
  return {
    jour: 1,
    argent: 8000000,        // 8 millions d'euros au départ
    reputation: 50,         // sur 100 : la confiance des voyageurs
    dette: 0,               // ce qu'on doit à la banque
    aeroport: { niveau: 1 },// on commence avec un simple aérodrome (2 portes)
    personnel: { pilotes: 8, mecaniciens: 1, agents: 2 }, // de quoi faire voler 2 avions
    flotte: [],             // les avions qu'on possède
    lignes: [],             // les lignes aériennes qu'on a ouvertes
    journal: [],            // l'historique des événements
    prochainIdAvion: 1,     // compteur pour donner un numéro unique à chaque avion
    prochainIdLigne: 1,     // pareil pour les lignes
  };
}

let etat = etatInitial();


/* =====================================================================
   3. LES OUTILS DE CALCUL
   ===================================================================== */

/* Retrouve la fiche d'une ville à partir de son nom. */
function ville(nom) {
  return VILLES.find(v => v.nom === nom);
}

/* Retrouve la fiche d'un modèle d'avion à partir de son identifiant. */
function modele(id) {
  return MODELES.find(m => m.id === id);
}

/* Distance (en km) entre deux villes.
   On utilise le théorème de Pythagore sur les coordonnées, puis on
   multiplie par 30 pour obtenir des kilomètres "crédibles". */
function distance(nomA, nomB) {
  const a = ville(nomA), b = ville(nomB);
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.round(Math.sqrt(dx * dx + dy * dy) * 30);
}

/* Prix de billet "juste" conseillé selon la distance.
   Plus c'est loin, plus le billet coûte cher. */
function prixConseille(dist) {
  return Math.round(30 + dist * 0.08);
}

/* Combien de voyageurs VEULENT prendre cette ligne par jour, AU TOTAL
   (aller + retour confondus). Ce nombre dépend de :
   - l'attractivité des deux villes (trafic)
   - le prix du billet par rapport au prix conseillé (trop cher = moins de monde)
   - la réputation de la compagnie
   C'est le "potentiel" : l'avion ne pourra pas forcément tout transporter. */
function demandePotentielle(ligne) {
  const a = ville(ligne.villeA), b = ville(ligne.villeB);
  const dist = distance(ligne.villeA, ligne.villeB);

  // Base : deux grosses villes proches = beaucoup de demande.
  let base = (a.trafic + b.trafic) * 22;

  // Les très longues distances réduisent un peu la demande quotidienne.
  base = base * (1 - Math.min(dist, 12000) / 30000);

  // Effet du prix (l'« élasticité »). On compare le prix choisi au prix
  // conseillé. ratio = 1 -> on est pile au prix conseillé.
  const ref = prixConseille(dist);
  const ratio = ligne.prixBillet / ref;
  //  - au prix conseillé (ratio 1)      -> facteur 1
  //  - moins cher (ratio < 1)           -> bonus, plafonné à 1,6
  //  - plus cher                        -> la demande CHUTE et atteint 0
  //    vers 3,5× le prix conseillé : à 500 000 € le billet, plus personne !
  let facteurPrix = 1 - (ratio - 1) / 2.5;
  facteurPrix = Math.max(0, Math.min(facteurPrix, 1.6));

  // Effet réputation : 50 = neutre (facteur 1).
  const facteurRepu = 0.5 + etat.reputation / 100;

  // Effet du personnel au sol : un bon accueil capte un peu plus de monde.
  const facteurService = facteurServiceSol();

  return Math.round(base * facteurPrix * facteurRepu * facteurService);
}

/* Combien de rotations (aller-retour) un avion peut faire en une journée
   sur cette distance. On part d'une journée d'exploitation de 16 h, et
   on ajoute 1 h d'escale à chaque atterrissage. */
function rotationsParJour(dist, vitesse) {
  const heuresVol = dist / vitesse;               // durée d'un trajet simple
  const dureeRotation = 2 * heuresVol + 2;        // aller + retour + 2 escales
  return Math.max(0, Math.floor(16 / dureeRotation));
}

/* Formate un nombre d'euros joliment : 1234567 -> "1 234 567 €" */
function euros(n) {
  return Math.round(n).toLocaleString("fr-FR") + " €";
}

/* La fiche du niveau d'aéroport actuel. */
function aeroportActuel() {
  return AEROPORT_NIVEAUX[etat.aeroport.niveau - 1];
}

/* Nombre maximum d'avions pouvant opérer en même temps = le plus petit
   entre le nombre de portes ET le nombre d'équipages disponibles.
   C'est ce qui relie l'aéroport, le personnel et la flotte. */
function capaciteOperationnelle() {
  const portes = aeroportActuel().portes;
  const equipages = Math.floor(etat.personnel.pilotes / EQUIPAGE_PAR_AVION);
  return Math.min(portes, equipages);
}

/* Effet des agents au sol : un meilleur accueil capte un peu plus de
   voyageurs (jusqu'à +30 %). */
function facteurServiceSol() {
  return Math.min(1.3, 1 + etat.personnel.agents * 0.02);
}

/* Effet des mécaniciens : ils ralentissent l'usure et allègent l'entretien
   (jusqu'à -40 %). Renvoie un multiplicateur entre 0,6 et 1. */
function facteurMecano() {
  return Math.max(0.6, 1 - etat.personnel.mecaniciens * 0.04);
}

/* Coût fixe total prélevé chaque jour, quoi qu'il arrive : salaires,
   fonctionnement de l'aéroport et intérêts de la dette. */
function coutsFixesJournaliers() {
  const salaires = etat.personnel.pilotes * SALAIRES.pilote
                 + etat.personnel.mecaniciens * SALAIRES.mecanicien
                 + etat.personnel.agents * SALAIRES.agent;
  const aeroport = aeroportActuel().coutJournalier;
  const interets = etat.dette * TAUX_INTERET_JOUR;
  return { salaires, aeroport, interets, total: salaires + aeroport + interets };
}


/* =====================================================================
   4. LES ACTIONS DU JOUEUR
   ===================================================================== */

/* Ajoute une phrase dans le journal de bord.
   type peut être "neutre", "bon" ou "mauvais" (pour la couleur). */
function noter(texte, type = "neutre") {
  etat.journal.unshift({ jour: etat.jour, texte, type });
}

/* Acheter un avion d'un certain modèle. */
function acheterAvion(idModele) {
  const m = modele(idModele);
  if (etat.argent < m.prix) {
    alert("Pas assez d'argent pour acheter un " + m.nom + " !");
    return;
  }
  etat.argent -= m.prix;
  const avion = {
    id: etat.prochainIdAvion++,
    modeleId: m.id,
    nom: m.nom + " #" + etat.prochainIdAvion,
    usure: 0,            // de 0 (neuf) à 100 (épave) : on s'en sert plus tard
    ligneId: null,       // null = pas encore assigné à une ligne
  };
  etat.flotte.push(avion);
  noter("Achat d'un " + m.nom + " pour " + euros(m.prix) + ".");
  toutAfficher();
}

/* Ouvrir une nouvelle ligne entre deux villes. */
function creerLigne(nomA, nomB, prix) {
  if (nomA === nomB) { alert("Choisis deux villes différentes."); return; }
  const dist = distance(nomA, nomB);
  const ligne = {
    id: etat.prochainIdLigne++,
    villeA: nomA,
    villeB: nomB,
    prixBillet: prix,
    avionId: null,       // aucun avion assigné pour l'instant
  };
  etat.lignes.push(ligne);
  noter("Nouvelle ligne ouverte : " + nomA + " ⇄ " + nomB + " (" + dist + " km).");
  toutAfficher();
}

/* Assigner (ou retirer) un avion sur une ligne. */
function assignerAvion(ligneId, avionId) {
  const ligne = etat.lignes.find(l => l.id === ligneId);

  // D'abord on libère l'éventuel avion déjà posé sur cette ligne.
  if (ligne.avionId !== null) {
    const ancien = etat.flotte.find(a => a.id === ligne.avionId);
    if (ancien) ancien.ligneId = null;
  }

  if (avionId === "") {            // l'utilisateur a choisi "aucun"
    ligne.avionId = null;
  } else {
    avionId = Number(avionId);
    const avion = etat.flotte.find(a => a.id === avionId);
    const m = modele(avion.modeleId);
    const dist = distance(ligne.villeA, ligne.villeB);
    if (dist > m.rayon) {
      alert("Le " + m.nom + " ne peut pas voler aussi loin (" + dist +
            " km > rayon de " + m.rayon + " km).");
      return;
    }
    // Si cet avion était sur une autre ligne, on l'en retire.
    if (avion.ligneId !== null) {
      const autre = etat.lignes.find(l => l.id === avion.ligneId);
      if (autre) autre.avionId = null;
    }
    avion.ligneId = ligne.id;
    ligne.avionId = avion.id;
  }
  toutAfficher();
}

/* ---- BANQUE ---- */

/* Emprunter de l'argent à la banque (augmente l'argent ET la dette). */
function emprunter(montant) {
  montant = Number(montant);
  if (montant <= 0) return;
  if (etat.dette + montant > DETTE_MAX) {
    alert("La banque refuse : la dette dépasserait le plafond de " + euros(DETTE_MAX) + ".");
    return;
  }
  etat.argent += montant;
  etat.dette += montant;
  noter("Emprunt de " + euros(montant) + " auprès de la banque.");
  toutAfficher();
}

/* Rembourser une partie de la dette (diminue l'argent ET la dette). */
function rembourser(montant) {
  montant = Number(montant);
  if (montant <= 0) return;
  montant = Math.min(montant, etat.dette, etat.argent);  // pas plus que dû/possédé
  if (montant <= 0) { alert("Rien à rembourser ou trésorerie insuffisante."); return; }
  etat.argent -= montant;
  etat.dette -= montant;
  noter("Remboursement de " + euros(montant) + " à la banque.", "bon");
  toutAfficher();
}

/* ---- AÉROPORT ---- */

/* Agrandir l'aéroport au niveau suivant. */
function ameliorerAeroport() {
  const niveauSuivant = AEROPORT_NIVEAUX[etat.aeroport.niveau]; // niveau d'après
  if (!niveauSuivant) { alert("Ton aéroport est déjà au niveau maximum !"); return; }
  if (etat.argent < niveauSuivant.prixAmelioration) {
    alert("Pas assez d'argent pour agrandir (" + euros(niveauSuivant.prixAmelioration) + ").");
    return;
  }
  etat.argent -= niveauSuivant.prixAmelioration;
  etat.aeroport.niveau++;
  noter("Aéroport agrandi : « " + niveauSuivant.nom + " » (" + niveauSuivant.portes + " portes).", "bon");
  toutAfficher();
}

/* ---- PERSONNEL ---- */

/* Embaucher 1 employé d'un métier (le salaire sera prélevé chaque jour). */
function embaucher(metier) {
  etat.personnel[metier]++;
  toutAfficher();
}

/* Licencier 1 employé d'un métier (on ne descend jamais sous 0). */
function licencier(metier) {
  if (etat.personnel[metier] > 0) etat.personnel[metier]--;
  toutAfficher();
}

/* ---- RÉPARATION ---- */

/* Réparer un avion : ramène son usure à 0 contre de l'argent.
   Plus l'avion est usé, plus la réparation coûte cher. */
function reparerAvion(avionId) {
  const avion = etat.flotte.find(a => a.id === avionId);
  const m = modele(avion.modeleId);
  const cout = Math.round(m.prix * 0.002 * avion.usure); // 0,2 % du prix neuf par point d'usure
  if (cout <= 0) { alert("Cet avion est déjà comme neuf."); return; }
  if (etat.argent < cout) { alert("Réparation trop chère : " + euros(cout) + "."); return; }
  etat.argent -= cout;
  avion.usure = 0;
  noter("Révision complète du " + avion.nom + " pour " + euros(cout) + ".");
  toutAfficher();
}

/* ---- SAUVEGARDE (dans le navigateur, via localStorage) ---- */

function sauvegarder() {
  try {
    localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(etat));
    noter("Partie sauvegardée.", "bon");
  } catch (e) {
    alert("Impossible de sauvegarder (stockage du navigateur indisponible).");
  }
  toutAfficher();
}

function charger() {
  let donnees = null;
  try { donnees = localStorage.getItem(CLE_SAUVEGARDE); } catch (e) {}
  if (!donnees) { alert("Aucune sauvegarde trouvée."); return; }
  etat = JSON.parse(donnees);
  noter("Partie chargée.");
  toutAfficher();
}

function nouvellePartie() {
  if (!confirm("Recommencer une nouvelle partie ? La progression actuelle non sauvegardée sera perdue.")) return;
  etat = etatInitial();
  noter("Nouvelle partie lancée. Bonne chance !");
  toutAfficher();
}

/* Fermer une ligne (et libérer son avion). */
function fermerLigne(ligneId) {
  const ligne = etat.lignes.find(l => l.id === ligneId);
  if (ligne.avionId !== null) {
    const a = etat.flotte.find(av => av.id === ligne.avionId);
    if (a) a.ligneId = null;
  }
  etat.lignes = etat.lignes.filter(l => l.id !== ligneId);
  noter("Ligne " + ligne.villeA + " ⇄ " + ligne.villeB + " fermée.", "mauvais");
  toutAfficher();
}


/* =====================================================================
   5. LA SIMULATION D'UNE JOURNÉE
   ---------------------------------------------------------------------
   C'est le cœur du jeu. Quand on clique sur « Jour suivant », on calcule
   pour CHAQUE ligne combien on a transporté de passagers, gagné d'argent
   et dépensé en carburant + entretien.
   ===================================================================== */
function passerJour() {
  let recettes = 0;       // tout l'argent gagné dans la journée
  let depenses = 0;       // tout l'argent dépensé
  let passagersTotal = 0;
  let placesVides = 0;    // sert à ajuster la réputation

  // Combien d'avions peuvent voler aujourd'hui (limité par les portes de
  // l'aéroport ET le nombre d'équipages). Les avions en trop restent au sol.
  const capacite = capaciteOperationnelle();
  const facteurEntretien = facteurMecano();   // les mécanos allègent les coûts
  let avionsEnVol = 0;
  let avionsCloues = 0;

  // --- On traite chaque ligne ---
  for (const ligne of etat.lignes) {
    // Pas d'avion = la ligne ne tourne pas, mais on n'oublie pas que
    // les avions au sol coûtent quand même leur entretien (plus bas).
    if (ligne.avionId === null) continue;

    // Si on a déjà atteint la capacité, cet avion reste cloué au sol.
    if (avionsEnVol >= capacite) { avionsCloues++; continue; }
    avionsEnVol++;

    const avion = etat.flotte.find(a => a.id === ligne.avionId);
    const m = modele(avion.modeleId);
    const dist = distance(ligne.villeA, ligne.villeB);

    const rotations = rotationsParJour(dist, m.vitesse);
    const placesOffertes = rotations * 2 * m.capacite;   // *2 = aller + retour
    const demande = demandePotentielle(ligne);

    // On transporte le minimum entre ce qu'on offre et ce que veulent les gens.
    const passagers = Math.min(placesOffertes, demande);
    passagersTotal += passagers;
    placesVides += Math.max(0, placesOffertes - passagers);

    // Recette = passagers transportés × prix du billet.
    const recetteLigne = passagers * ligne.prixBillet;

    // Carburant = distance parcourue dans la journée × conso. Une rotation
    // = 2 trajets, donc 2 × dist par rotation.
    const carburant = rotations * 2 * dist * m.conso;

    // L'usure fait grimper l'entretien : un avion fatigué coûte plus cher.
    const surcoutUsure = m.maintenance * (avion.usure / 100);

    recettes += recetteLigne;
    depenses += (carburant + surcoutUsure) * facteurEntretien;

    // L'avion s'use à force de voler (les mécanos ralentissent l'usure).
    avion.usure = Math.min(100, avion.usure + rotations * 0.6 * facteurEntretien);
  }

  // --- Entretien de base de TOUS les avions (même ceux au sol) ---
  for (const avion of etat.flotte) {
    depenses += modele(avion.modeleId).maintenance * facteurEntretien;
  }

  // --- Coûts fixes : salaires + fonctionnement aéroport + intérêts dette ---
  const fixes = coutsFixesJournaliers();
  depenses += fixes.total;

  // --- Mise à jour de l'argent ---
  const benefice = recettes - depenses;
  etat.argent += benefice;

  // Message si des avions n'ont pas pu décoller faute de capacité.
  if (avionsCloues > 0) {
    noter("⚠️ " + avionsCloues + " avion(s) cloué(s) au sol : agrandis l'aéroport ou embauche des pilotes.", "mauvais");
  }

  // --- Mise à jour de la réputation ---
  // Beaucoup de places vides => clients déçus de voir des vols à moitié
  // pleins ? Non : ici on récompense plutôt le fait de bien servir la
  // demande. Si on transporte beaucoup de monde, la réputation monte.
  if (passagersTotal > 0) {
    etat.reputation = Math.min(100, etat.reputation + 0.5);
  } else if (etat.lignes.length > 0) {
    etat.reputation = Math.max(0, etat.reputation - 0.3);
  }

  // --- On écrit le bilan dans le journal ---
  const signe = benefice >= 0 ? "+" : "";
  noter("Jour " + etat.jour + " : " + passagersTotal.toLocaleString("fr-FR") +
        " passagers, bilan " + signe + euros(benefice) + ".",
        benefice >= 0 ? "bon" : "mauvais");

  // Petit avertissement si la trésorerie devient négative.
  if (etat.argent < 0) {
    noter("⚠️ Trésorerie dans le rouge ! Réduis les coûts ou augmente les recettes.", "mauvais");
  }

  // On retient le bilan pour l'afficher sur le tableau de bord.
  etat.dernierBilan = { recettes, depenses, benefice, passagersTotal, fixes };

  etat.jour++;

  // Sauvegarde automatique à la fin de chaque journée. On l'entoure d'un
  // "try" : si le navigateur interdit le stockage local, le jeu continue.
  try { localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(etat)); } catch (e) {}

  toutAfficher();
}


/* =====================================================================
   6. L'AFFICHAGE
   ---------------------------------------------------------------------
   Ces fonctions lisent l'état du jeu et "dessinent" le texte/HTML dans
   les bonnes zones de la page. On ne change JAMAIS l'état ici, on ne
   fait que l'afficher.
   ===================================================================== */

/* Petit raccourci : $("mon-id") renvoie l'élément HTML correspondant. */
function $(id) { return document.getElementById(id); }

/* Met à jour la barre du haut. */
function afficherBarreHaut() {
  $("aff-jour").textContent = etat.jour;
  $("aff-argent").textContent = euros(etat.argent);
  $("aff-reputation").textContent = Math.round(etat.reputation);
}

/* Tableau de bord : quelques grandes cartes + le bilan du jour. */
function afficherTableau() {
  const cartes = [
    { titre: "Trésorerie", valeur: euros(etat.argent) },
    { titre: "Dette", valeur: euros(etat.dette) },
    { titre: "Aéroport", valeur: aeroportActuel().nom + " (" + aeroportActuel().portes + " portes)" },
    { titre: "Capacité de vol", valeur: capaciteOperationnelle() + " avions/jour" },
    { titre: "Avions / Lignes", valeur: etat.flotte.length + " / " + etat.lignes.length },
    { titre: "Réputation", valeur: Math.round(etat.reputation) + " / 100" },
  ];
  $("resume-cartes").innerHTML = cartes.map(c => `
    <div class="carte">
      <h4>${c.titre}</h4>
      <div class="grande-valeur">${c.valeur}</div>
    </div>`).join("");

  const b = etat.dernierBilan;
  if (b) {
    const classe = b.benefice >= 0 ? "positif" : "negatif";
    $("resume-journee").innerHTML = `
      <div class="stat"><span>Passagers transportés</span><span>${b.passagersTotal.toLocaleString("fr-FR")}</span></div>
      <div class="stat"><span>Recettes (billets)</span><span class="positif">${euros(b.recettes)}</span></div>
      <div class="stat"><span>Dépenses totales</span><span class="negatif">${euros(b.depenses)}</span></div>
      <div class="stat" style="padding-left:16px;color:#6b7a8d"><span>↳ dont salaires</span><span>${euros(b.fixes.salaires)}</span></div>
      <div class="stat" style="padding-left:16px;color:#6b7a8d"><span>↳ dont aéroport</span><span>${euros(b.fixes.aeroport)}</span></div>
      <div class="stat" style="padding-left:16px;color:#6b7a8d"><span>↳ dont intérêts dette</span><span>${euros(b.fixes.interets)}</span></div>
      <div class="stat"><span>Bénéfice du jour</span><span class="${classe}">${euros(b.benefice)}</span></div>`;
  }
}

/* La page « Finances » : banque + aéroport. */
function afficherFinances() {
  const fixes = coutsFixesJournaliers();
  $("resume-banque").innerHTML = `
    <div class="stat"><span>Dette actuelle</span><span>${euros(etat.dette)}</span></div>
    <div class="stat"><span>Intérêts prélevés / jour</span><span class="negatif">${euros(fixes.interets)}</span></div>
    <div class="stat"><span>Plafond d'emprunt</span><span>${euros(DETTE_MAX)}</span></div>`;

  const actuel = aeroportActuel();
  const suivant = AEROPORT_NIVEAUX[etat.aeroport.niveau]; // peut être undefined si max
  let blocSuivant;
  if (suivant) {
    const assez = etat.argent >= suivant.prixAmelioration;
    blocSuivant = `
      <div class="stat"><span>Niveau suivant</span><span>${suivant.nom} (${suivant.portes} portes)</span></div>
      <div class="stat"><span>Coût d'agrandissement</span><span>${euros(suivant.prixAmelioration)}</span></div>
      <div class="stat"><span>Frais de fonctionnement</span><span>${euros(suivant.coutJournalier)}/jour</span></div>
      <button class="bouton-principal" ${assez ? "" : "disabled"} onclick="ameliorerAeroport()">Agrandir l'aéroport</button>`;
  } else {
    blocSuivant = `<p class="positif">Aéroport au niveau maximum 🎉</p>`;
  }
  $("resume-aeroport").innerHTML = `
    <div class="stat"><span>Niveau actuel</span><span>${actuel.nom}</span></div>
    <div class="stat"><span>Portes (avions simultanés)</span><span>${actuel.portes}</span></div>
    <div class="stat"><span>Frais de fonctionnement</span><span>${euros(actuel.coutJournalier)}/jour</span></div>
    <hr style="border:none;border-top:1px solid #e2e8f2;margin:10px 0">
    ${blocSuivant}`;
}

/* La page « Personnel » : une carte par métier. */
function afficherPersonnel() {
  const equipagesDispo = Math.floor(etat.personnel.pilotes / EQUIPAGE_PAR_AVION);
  const metiers = [
    { cle: "pilotes",     nom: "Pilotes",           emoji: "👨‍✈️",
      effet: `${EQUIPAGE_PAR_AVION} pilotes = 1 avion en service. Équipages dispo : <strong>${equipagesDispo}</strong>.`,
      salaire: SALAIRES.pilote },
    { cle: "mecaniciens", nom: "Mécaniciens",       emoji: "🔧",
      effet: `Réduisent l'usure et l'entretien. Réduction actuelle : <strong>${Math.round((1 - facteurMecano()) * 100)}%</strong>.`,
      salaire: SALAIRES.mecanicien },
    { cle: "agents",      nom: "Agents au sol",     emoji: "🧳",
      effet: `Améliorent l'accueil et captent plus de voyageurs : <strong>+${Math.round((facteurServiceSol() - 1) * 100)}%</strong>.`,
      salaire: SALAIRES.agent },
  ];
  $("liste-personnel").innerHTML = metiers.map(m => `
    <div class="carte">
      <h3>${m.emoji} ${m.nom}</h3>
      <div class="grande-valeur">${etat.personnel[m.cle]}</div>
      <p class="aide">${m.effet}</p>
      <div class="stat"><span>Salaire</span><span>${euros(m.salaire)}/jour chacun</span></div>
      <div class="formulaire" style="margin-top:8px">
        <button class="bouton-secondaire" onclick="embaucher('${m.cle}')">+ Embaucher</button>
        <button class="bouton-secondaire bouton-danger" onclick="licencier('${m.cle}')">− Licencier</button>
      </div>
    </div>`).join("");
}

/* La page « Marché » : une carte par modèle achetable. */
function afficherMarche() {
  $("liste-marche").innerHTML = MODELES.map(m => `
    <div class="carte">
      <h3>${m.nom}</h3>
      <div class="stat"><span>Capacité</span><span>${m.capacite} sièges</span></div>
      <div class="stat"><span>Rayon d'action</span><span>${m.rayon.toLocaleString("fr-FR")} km</span></div>
      <div class="stat"><span>Vitesse</span><span>${m.vitesse} km/h</span></div>
      <div class="stat"><span>Carburant</span><span>${m.conso} €/km</span></div>
      <div class="stat"><span>Entretien</span><span>${euros(m.maintenance)}/jour</span></div>
      <div class="stat"><span>Prix</span><span>${euros(m.prix)}</span></div>
      <button class="bouton-principal" onclick="acheterAvion('${m.id}')">Acheter</button>
    </div>`).join("");
}

/* La page « Flotte » : la liste des avions possédés avec leur usure. */
function afficherFlotte() {
  if (etat.flotte.length === 0) {
    $("liste-flotte").innerHTML = `<p class="aide">Tu n'as encore aucun avion. Va dans « Marché des avions ».</p>`;
    return;
  }
  $("liste-flotte").innerHTML = `<div class="grille-cartes">` + etat.flotte.map(a => {
    const m = modele(a.modeleId);
    const ligne = etat.lignes.find(l => l.id === a.ligneId);
    const affecte = ligne ? (ligne.villeA + " ⇄ " + ligne.villeB) : "Au sol";
    const coutRepa = Math.round(m.prix * 0.002 * a.usure);
    return `
      <div class="carte">
        <h4>${a.nom}</h4>
        <div class="stat"><span>Type</span><span>${m.nom}</span></div>
        <div class="stat"><span>Affectation</span><span>${affecte}</span></div>
        <div class="stat"><span>Usure</span><span>${Math.round(a.usure)}%</span></div>
        <div class="barre-fond"><div class="barre-remplie" style="width:${a.usure}%;
             background:${a.usure > 70 ? 'var(--rouge)' : a.usure > 40 ? 'var(--jaune)' : 'var(--vert)'}"></div></div>
        <button class="bouton-secondaire" style="margin-top:10px" ${a.usure < 1 ? "disabled" : ""}
                onclick="reparerAvion(${a.id})">Réparer (${euros(coutRepa)})</button>
      </div>`;
  }).join("") + `</div>`;
}

/* Remplit les deux menus déroulants de choix de villes. */
function remplirSelectsVilles() {
  const options = VILLES.map(v => `<option value="${v.nom}">${v.nom}</option>`).join("");
  $("select-ville-a").innerHTML = options;
  $("select-ville-b").innerHTML = options;
  $("select-ville-b").selectedIndex = 1;   // par défaut, deuxième ville différente
}

/* La page « Lignes » : le formulaire d'aide + la liste des lignes. */
function afficherLignes() {
  // Petit texte d'aide sous le formulaire : distance et prix conseillé.
  const a = $("select-ville-a").value, b = $("select-ville-b").value;
  if (a && b && a !== b) {
    const d = distance(a, b);
    $("info-ligne").textContent =
      "Distance : " + d.toLocaleString("fr-FR") + " km — prix conseillé : " + euros(prixConseille(d));
  } else {
    $("info-ligne").textContent = "";
  }

  if (etat.lignes.length === 0) {
    $("liste-lignes").innerHTML = `<p class="aide">Aucune ligne pour l'instant.</p>`;
    return;
  }

  $("liste-lignes").innerHTML = etat.lignes.map(ligne => {
    const d = distance(ligne.villeA, ligne.villeB);

    // Construit la liste déroulante des avions assignables à cette ligne.
    let optionsAvions = `<option value="">— Aucun avion —</option>`;
    for (const av of etat.flotte) {
      const m = modele(av.modeleId);
      const possible = d <= m.rayon && (av.ligneId === null || av.ligneId === ligne.id);
      if (!possible) continue;
      const selectionne = av.ligneId === ligne.id ? "selected" : "";
      optionsAvions += `<option value="${av.id}" ${selectionne}>${av.nom} (${m.capacite} sièges)</option>`;
    }

    // Aperçu de ce que rapporte la ligne avec l'avion actuel.
    let apercu = "Aucun avion assigné.";
    if (ligne.avionId !== null) {
      const av = etat.flotte.find(a => a.id === ligne.avionId);
      const m = modele(av.modeleId);
      const rot = rotationsParJour(d, m.vitesse);
      const offre = rot * 2 * m.capacite;
      const demande = demandePotentielle(ligne);
      apercu = `${rot} rotations/jour · ${offre} places offertes · ${demande} voyageurs attendus`;
    }

    return `
      <div class="encart">
        <h3>${ligne.villeA} ⇄ ${ligne.villeB}</h3>
        <div class="stat"><span>Distance</span><span>${d.toLocaleString("fr-FR")} km</span></div>
        <div class="stat"><span>Prix du billet</span><span>${euros(ligne.prixBillet)}</span></div>
        <p class="aide">${apercu}</p>
        <div class="formulaire">
          <label>Avion assigné
            <select onchange="assignerAvion(${ligne.id}, this.value)">${optionsAvions}</select>
          </label>
          <label>Prix du billet
            <input type="number" value="${ligne.prixBillet}" min="10"
                   onchange="modifierPrix(${ligne.id}, this.value)" />
          </label>
          <button class="bouton-secondaire bouton-danger" onclick="fermerLigne(${ligne.id})">Fermer la ligne</button>
        </div>
      </div>`;
  }).join("");
}

/* Change le prix d'une ligne existante. */
function modifierPrix(ligneId, nouveauPrix) {
  const ligne = etat.lignes.find(l => l.id === ligneId);
  ligne.prixBillet = Math.max(10, Number(nouveauPrix));
  toutAfficher();
}

/* La page « Journal ». */
function afficherJournal() {
  if (etat.journal.length === 0) {
    $("liste-journal").innerHTML = `<p class="aide">Rien à signaler pour le moment.</p>`;
    return;
  }
  $("liste-journal").innerHTML = etat.journal.map(e => `
    <div class="ligne-journal ${e.type === 'bon' ? 'bon' : e.type === 'mauvais' ? 'mauvais' : ''}">
      <strong>Jour ${e.jour}</strong> — ${e.texte}
    </div>`).join("");
}

/* Rafraîchit TOUTES les zones de la page d'un coup. */
function toutAfficher() {
  afficherBarreHaut();
  afficherTableau();
  afficherMarche();
  afficherFlotte();
  afficherLignes();
  afficherFinances();
  afficherPersonnel();
  afficherJournal();
}


/* =====================================================================
   7. LE DÉMARRAGE
   ---------------------------------------------------------------------
   On "branche" les boutons sur les fonctions, puis on lance un premier
   affichage. Ce bloc s'exécute une seule fois, au chargement de la page.
   ===================================================================== */

/* Gestion des onglets : cliquer sur un onglet affiche la bonne page. */
document.querySelectorAll(".onglet").forEach(bouton => {
  bouton.addEventListener("click", () => {
    document.querySelectorAll(".onglet").forEach(o => o.classList.remove("actif"));
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    bouton.classList.add("actif");
    $(bouton.dataset.cible).classList.add("active");
  });
});

/* Le bouton « Passer au jour suivant ». */
$("btn-jour").addEventListener("click", passerJour);

/* Le bouton « Ouvrir la ligne » dans la page Lignes. */
$("btn-creer-ligne").addEventListener("click", () => {
  const a = $("select-ville-a").value;
  const b = $("select-ville-b").value;
  const prix = Math.max(10, Number($("input-prix").value));
  creerLigne(a, b, prix);
});

/* Quand on change une ville dans le formulaire, on met à jour l'aide. */
$("select-ville-a").addEventListener("change", afficherLignes);
$("select-ville-b").addEventListener("change", afficherLignes);

/* Boutons de la page Finances. */
$("btn-emprunter").addEventListener("click", () => emprunter($("input-montant-banque").value));
$("btn-rembourser").addEventListener("click", () => rembourser($("input-montant-banque").value));
$("btn-sauvegarder").addEventListener("click", sauvegarder);
$("btn-charger").addEventListener("click", charger);
$("btn-nouvelle").addEventListener("click", nouvellePartie);

/* On prépare les listes de villes puis on dessine tout une première fois. */
remplirSelectsVilles();
noter("Bienvenue à la tête de ta compagnie aérienne ! Tu démarres avec " + euros(etat.argent) + ".");
toutAfficher();
