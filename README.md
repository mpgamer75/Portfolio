# Portfolio Charles Lantigua Jorge

Portfolio professionnel moderne avec thème cybersécurité, construit avec Next.js 14, TypeScript, Tailwind CSS et Framer Motion.

## 🚀 Fonctionnalités

- ✅ Design moderne avec thème cybersécurité
- ✅ Animations fluides et interactives (Framer Motion)
- ✅ Background animé "Liquid Ether" inspiré de React Bits
- ✅ Internationalisation (Français/Anglais)
- ✅ Navigation responsive avec toggle de langue
- ✅ Sections : Hero, About, Experience, Projects, Skills, Contact
- ✅ Timeline interactive pour l'expérience
- ✅ Cartes de projets avec emplacements pour images
- ✅ Design responsive (mobile, tablet, desktop)
- ✅ Optimisé pour les performances

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev

# Build pour production
npm run build

# Démarrer en production
npm start
```

## 🖼️ Ajout des images

### Images de projets
Placez vos images de projets dans le dossier `/public/images/projects/` avec les noms suivants :
- `security-scanner.png` (800x400px recommandé)
- `encryptor.png` (800x400px recommandé)
- `saber.png` (800x400px recommandé)
- `ioc-app.png` (600x400px recommandé)
- `warhammer.png` (600x400px recommandé)

Puis décommentez les lignes `imagePath` dans `/components/sections/ProjectsSection.tsx`

### Photo professionnelle
Placez votre photo dans `/public/images/hero/profile.jpg` (400x400px recommandé)
Puis décommentez la ligne Image dans `/components/sections/AboutSection.tsx`

## 🎨 Personnalisation

### Couleurs
Modifiez les couleurs dans `tailwind.config.ts` :
```typescript
colors: {
  cyber: {
    primary: "#00ff41",    // Vert terminal
    secondary: "#0affef",  // Cyan
    dark: "#0a0e27",       // Bleu foncé
    darker: "#050814",     // Noir bleuté
    accent: "#ff006e",     // Rose/Rouge
  },
}
```

### Traductions
Modifiez les fichiers `/messages/fr.json` et `/messages/en.json`

### Informations personnelles
Mettez à jour :
- Les liens GitHub/LinkedIn dans les fichiers de composants
- Les informations de contact dans `/messages/fr.json` et `/messages/en.json`

## 📁 Structure du projet

```
portfolio/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx        # Layout avec i18n
│   │   └── page.tsx          # Page principale
│   └── globals.css           # Styles globaux
├── components/
│   ├── sections/
│   │   ├── HeroSection.tsx
│   │   ├── AboutSection.tsx
│   │   ├── ExperienceSection.tsx
│   │   ├── ProjectsSection.tsx
│   │   ├── SkillsSection.tsx
│   │   └── ContactSection.tsx
│   └── ui/
│       ├── Navigation.tsx
│       ├── LiquidEther.tsx
│       ├── ProjectCard.tsx
│       └── Footer.tsx
├── messages/
│   ├── en.json               # Traductions anglaises
│   └── fr.json               # Traductions françaises
├── public/
│   └── images/
│       ├── projects/         # Images des projets
│       └── hero/             # Photo de profil
├── i18n.ts                   # Configuration i18n
├── middleware.ts             # Middleware Next.js
├── tailwind.config.ts        # Configuration Tailwind
└── package.json
```

## 🌐 Déploiement

### Vercel (Recommandé)
```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel
```

### Autres plateformes
Le projet peut être déployé sur n'importe quelle plateforme supportant Next.js :
- Netlify
- Railway
- Render
- etc.

## 🎯 Composants React Bits utilisés

- **Liquid Ether Background** : Background animé avec particules
- **Card Navigation** : Navigation responsive avec animations
- Animations fluides avec Framer Motion
- Effets de hover et transitions

## 📝 To-Do

- [ ] Ajouter les images des projets
- [ ] Ajouter la photo professionnelle
- [ ] Configurer le formulaire de contact (optionnel)
- [ ] Ajouter Google Analytics (optionnel)
- [ ] Optimiser les images avec next/image

## 🔗 Liens utiles

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Framer Motion](https://www.framer.com/motion/)
- [next-intl](https://next-intl-docs.vercel.app/)
- [React Bits](https://reactbits.dev)

## 📧 Contact

Charles Lantigua Jorge
- Email: charleslantiguajorge@gmail.com
- LinkedIn: [Charles Lantigua Jorge](https://www.linkedin.com/in/charles-lantigua-jorge)
- GitHub: [@mpgamer75](https://github.com/mpgamer75)

---

**Built with ❤️ using Next.js and Tailwind CSS**
