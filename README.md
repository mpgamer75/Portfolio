# Portfolio Charles Lantigua Jorge

> *"It works on my machine"* — Every developer ever

Portfolio cyberpunk moderne construit avec Next.js 16, TypeScript, Tailwind CSS et Framer Motion. Aucun `sudo rm -rf /` n'a été exécuté pendant la création de ce projet. Probablement.

## Warning

```bash
$ cat /proc/sys/net/ipv4/tcp_syncookies
1  # Protected against SYN floods AND bad UI/UX
```

Ce portfolio est :

- Plus rapide qu'un `:(){ :|:& };:` fork bomb (mais moins destructif).
- Plus élégant qu'un `curl wttr.in`.
- Plus sécurisé que votre mot de passe "Password123".
- Plus animé qu'un hackerman dans un film hollywoodien.

## Features

- Design cybersécurité (non, il n'y a pas de Matrix scrolling text).
- Animations fluides (60 FPS constant, je promets que j'ai `killall -9 chrome`).
- Background animé "Prism" (GPU goes brrr).
- Navigation responsive (fonctionne même sur ton Nokia 3310).
- Sections : Hero, About, Experience, Projects, Skills, Contact.
- Timeline interactive (comme `git log --graph` mais en mieux).
- Cartes de projets avec animations (hover effects > Comic Sans).
- Design responsive (mobile, tablet, desktop, smartwatch... ok peut-être pas smartwatch).
- Optimisé pour les performances (pas de `while(true)` ici).

## Installation

```bash
# Cloner le repo (non, pas avec ctrl+c ctrl+v)
git clone https://github.com/mpgamer75/Portfolio.git
cd Portfolio

# Installer les dépendances
# Note: si ça échoue, essayez `sudo` comme tout bon linuxien
npm install

# Lancer le serveur de dev
npm run dev
# Maintenant ouvrez http://localhost:3000
# Pas http://127.0.0.1:3000, on est pas des sauvages

# Build pour production
npm run build
# Si vous voyez des erreurs TypeScript, ce n'est pas un bug, c'est une feature

# Démarrer en production
npm start
# Et priez que personne ne trouve de XSS
```

## Linux pro tips

```bash
# Pour les vrais hackers
alias deploy="git add . && git commit -m 'fix: stuff' && git push origin main"
alias yolo="git push --force"  # À vos risques et périls
alias please='sudo $(fc -ln -1)'  # Quand vous oubliez sudo

# Tester si le portfolio fonctionne
curl -I localhost:3000 | grep "200 OK" && echo "We're in!" || echo "Mission failed"

# Nettoyer node_modules (le dossier qui pèse plus lourd que la dette technique)
rm -rf node_modules && npm install  # IT Crowd: "Have you tried turning it off and on again?"
```

## Personnalisation

### Couleurs (pas de Comic Sans, promis)

Modifiez les couleurs dans `tailwind.config.ts` :

```typescript
colors: {
  cyber: {
    primary: "#FFFFFF",      // Blanc terminal (après 3h de debug)
    secondary: "#E5E7EB",    // Gris (couleur de mon âme après merge conflicts)
    dark: "#0a0e27",         // Noir bleuté (comme mon café)
    darker: "#050814",       // Plus noir que le void de JavaScript
    accent: "#B8C0D2",       // Gris clair (WCAG AA, on est sérieux)
  },
}
```

### Informations personnelles

Mettez à jour vos infos dans les composants :

- Les liens GitHub/LinkedIn (non, pas MySpace).
- Email de contact (non, pas ta GameMail de 2005).
- Photo de profil (non, pas un screenshot de Matrix).

## Structure du projet

```
portfolio/
├── app/                    # Next.js 16 App Router (RIP Pages Router)
│   ├── page.tsx           # Page principale (où la magie opère)
│   ├── layout.tsx         # Layout (le squelette, littéralement)
│   ├── globals.css        # CSS global (où les !important vont mourir)
│   ├── robots.ts          # robots.txt
│   └── sitemap.ts         # sitemap.xml
├── components/
│   ├── sections/          # Sections de la page
│   │   ├── HeroSection.tsx        # "Hi, I'm..." (original)
│   │   ├── AboutSection.tsx       # Parler de soi sans cringe
│   │   ├── ExperienceSection.tsx  # Timeline de carrière
│   │   ├── ProjectsSection.tsx    # Mes projets (3 stars sur GitHub)
│   │   ├── SkillsSection.tsx      # HTML n'est PAS un langage de programmation
│   │   └── ContactSection.tsx     # Slide into my DMs (professionnellement)
│   └── ui/
│       ├── Navigation.tsx         # Menu (hamburger > hotdog)
│       ├── Prism.tsx              # Background animé (WebGL enjoyer)
│       ├── Folder.tsx             # Animation dossier (files go brr)
│       ├── ClickSpark.tsx         # Sparks au clic (un peu de flair)
│       ├── DecryptedText.tsx      # Decrypt animation sur le hero
│       └── Footer.tsx             # Made with care
├── hooks/
│   └── useIsMobile.ts     # Single matchMedia source (DRY)
├── public/
│   └── images/            # Images (optimisées, pas des PNGs de 50MB)
│       ├── projects/      # Screenshots de projets
│       └── hero/          # Photo de profil
├── tailwind.config.ts     # Config Tailwind (utility classes > inline styles)
└── package.json           # Dépendances (node_modules pèse 300MB)
```

## Déploiement

### Vercel (le choix évident pour Next.js)

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel
# Attendez 30 secondes et boom, vous êtes en prod
# Pas besoin de Kubernetes pour un portfolio
```

### Autres plateformes

Le projet fonctionne sur :

- Netlify (pour les hipsters).
- Railway (all aboard the deploy train).
- Render (pourquoi pas).
- AWS EC2 (si vous aimez souffrir).
- Raspberry Pi dans votre garage (respect++).

## Sécurité

```bash
# Ce portfolio est protégé contre :
- SQL Injection (pas de SQL ici, checkmate hackers)         (done)
- XSS (React échappe tout automatiquement)                  (done)
- CSRF (merci Next.js)                                       (done)
- Mon chat qui marche sur le clavier                         (done)
- Regex DoS (on n'utilise pas de regex... ou si ?)           (todo)
```

CSP, HSTS, X-Frame-Options DENY, Permissions-Policy et X-Content-Type-Options sont câblés dans `next.config.js`.

## Stack technique

- **Next.js 16** : parce que PHP c'est so 2000.
- **React 19** : avec les rules of hooks renforcées (et oui, ça pique).
- **TypeScript** : `any` is not a type, fight me.
- **Tailwind CSS v3** : `className="mx-auto"` > `margin: 0 auto`.
- **Framer Motion 11** : animations sans jQuery (RIP).
- **Lucide Icons** : plus de 1000 icônes (et on en utilise 10).
- **OGL** : WebGL minimaliste pour le Prism background.

## To-Do (aka Technical Debt)

- [ ] Ajouter plus d'animations (parce qu'on n'est jamais trop cyberpunk).
- [ ] Optimiser les images (next/image fait déjà le job).
- [ ] Ajouter un mode sombre (wait, tout est déjà sombre).
- [ ] Passer à Bun au lieu de npm (gotta go fast).
- [ ] Refactoring (un jour... peut-être).
- [ ] Écrire des tests (un jour... probablement jamais).
- [ ] Documenter le code (vous lisez ça, ça compte ?).

## Bugs connus

```javascript
// Il n'y a pas de bugs, seulement des features non documentées
try {
  runPerfectCode();
} catch (reality) {
  console.log("It's not a bug, it's a feature!");
}
```

## Contribuer

Les PRs sont les bienvenues. Assurez-vous que :

1. Le code compile (`tsc --noEmit`).
2. Aucun conflit de merge (sinon on se bat en duel).
3. Le commit message est descriptif (pas de "fix stuff" ou "asdfasdf").
4. Vous avez testé localement (pas de YOLO push).

## Liens utiles

- [Next.js Docs](https://nextjs.org/docs) — RTFM.
- [Tailwind CSS](https://tailwindcss.com/docs) — utility classes paradise.
- [Framer Motion](https://www.framer.com/motion/) — animation wizardry.
- [Stack Overflow](https://stackoverflow.com/) — notre sauveur quotidien.
- [MDN Web Docs](https://developer.mozilla.org/) — la vraie documentation.
- [Can I Use](https://caniuse.com/) — "Does it work on IE?" "No."

## Contact

**Charles Lantigua Jorge**
*Cybersecurity Engineer & Software Developer*
*"In God we trust, all others we `nmap -sV`"*

- Email : charleslantiguajorge@gmail.com
- LinkedIn : [Charles Lantigua Jorge](https://www.linkedin.com/in/charles-lantigua-jorge)
- GitHub : [@mpgamer75](https://github.com/mpgamer75)

## License

MIT License — faites ce que vous voulez, mais si ça casse c'est pas ma faute.

---

<div align="center">

**Built with care, caffeine, and an unhealthy amount of `console.log()`.**

```ascii
  ____      _                                            _ _
 / ___|   _| |__   ___ _ __ ___  ___  ___ _   _ _ __ __| | |_ _   _
| |  | | | | '_ \ / _ \ '__/ __|/ _ \/ __| | | | '__/ _` | __| | | |
| |__| |_| | |_) |  __/ |  \__ \  __/ (__| |_| | | | (_| | |_| |_| |
 \____\__, |_.__/ \___|_|  |___/\___|\___|\__,_|_|  \__,_|\__|\__, |
      |___/                                                    |___/
```

*"There are 10 types of people in this world: those who understand binary, and those who don't."*

**[Back to top](#portfolio-charles-lantigua-jorge)**

</div>

---

> P.S. Si vous avez lu jusqu'ici, vous méritez une pause café.
> `document.cookie = "achievement=readme_master; Secure; SameSite=Strict"`
> (Oui, c'est un cookie sécurisé, on est des pros ici.)
