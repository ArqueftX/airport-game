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


/* =====================================================================
   2. L'ÉTAT DU JEU
   ---------------------------------------------------------------------
   "etat" est l'objet unique qui retient TOUT ce qui change pendant la
   partie. Si on voulait sauvegarder la partie, il suffirait de sauver
   cet objet. On y reviendra dans une prochaine partie.
   ===================================================================== */
let etat = {
  jour: 1,
  argent: 8000000,        // 8 millions d'euros au départ
  reputation: 50,         // sur 100 : la confiance des voyageurs
  flotte: [],             // les avions qu'on possède
  lignes: [],             // les lignes aériennes qu'on a ouvertes
  journal: [],            // l'historique des événements
  prochainIdAvion: 1,     // compteur pour donner un numéro unique à chaque avion
  prochainIdLigne: 1,     // pareil pour les lignes
};


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

  // Effet du prix : si on vend au prix conseillé -> facteur 1.
  // Plus cher -> moins de clients ; moins cher -> davantage (mais plafonné).
  const ref = prixConseille(dist);
  let facteurPrix = ref / ligne.prixBillet;        // ex : prix 2x trop cher -> 0.5
  facteurPrix = Math.max(0.1, Math.min(facteurPrix, 1.8));

  // Effet réputation : 50 = neutre (facteur 1).
  const facteurRepu = 0.5 + etat.reputation / 100;

  return Math.round(base * facteurPrix * facteurRepu);
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

  // --- On traite chaque ligne ---
  for (const ligne of etat.lignes) {
    // Pas d'avion = la ligne ne tourne pas, mais on n'oublie pas que
    // les avions au sol coûtent quand même leur entretien (plus bas).
    if (ligne.avionId === null) continue;

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
    depenses += carburant + surcoutUsure;

    // L'avion s'use à force de voler.
    avion.usure = Math.min(100, avion.usure + rotations * 0.6);
  }

  // --- Entretien de base de TOUS les avions (même ceux au sol) ---
  for (const avion of etat.flotte) {
    depenses += modele(avion.modeleId).maintenance;
  }

  // --- Mise à jour de l'argent ---
  const benefice = recettes - depenses;
  etat.argent += benefice;

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
  etat.dernierBilan = { recettes, depenses, benefice, passagersTotal };

  etat.jour++;
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
  const avionsLibres = etat.flotte.filter(a => a.ligneId === null).length;
  const cartes = [
    { titre: "Trésorerie", valeur: euros(etat.argent) },
    { titre: "Lignes ouvertes", valeur: etat.lignes.length },
    { titre: "Avions", valeur: etat.flotte.length + " (" + avionsLibres + " au sol)" },
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
      <div class="stat"><span>Recettes</span><span class="positif">${euros(b.recettes)}</span></div>
      <div class="stat"><span>Dépenses</span><span class="negatif">${euros(b.depenses)}</span></div>
      <div class="stat"><span>Bénéfice du jour</span><span class="${classe}">${euros(b.benefice)}</span></div>`;
  }
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
    return `
      <div class="carte">
        <h4>${a.nom}</h4>
        <div class="stat"><span>Type</span><span>${m.nom}</span></div>
        <div class="stat"><span>Affectation</span><span>${affecte}</span></div>
        <div class="stat"><span>Usure</span><span>${Math.round(a.usure)}%</span></div>
        <div class="barre-fond"><div class="barre-remplie" style="width:${a.usure}%;
             background:${a.usure > 70 ? 'var(--rouge)' : a.usure > 40 ? 'var(--jaune)' : 'var(--vert)'}"></div></div>
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

/* On prépare les listes de villes puis on dessine tout une première fois. */
remplirSelectsVilles();
noter("Bienvenue à la tête de ta compagnie aérienne ! Tu démarres avec " + euros(etat.argent) + ".");
toutAfficher();
