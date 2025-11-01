# 🔧 Commandes Utiles - Portfolio

## 🚀 Installation & Lancement

```bash
# Installation des dépendances
npm install

# Lancer en développement
npm run dev

# Build pour production
npm run build

# Lancer en production
npm start

# Linter
npm run lint
```

---

## 🌐 URLs Locales

- **Développement** : http://localhost:3000
- **Français** : http://localhost:3000/fr
- **Anglais** : http://localhost:3000/en

---

## 📦 Gestion des Dépendances

```bash
# Voir toutes les dépendances
npm list

# Mettre à jour les dépendances
npm update

# Vérifier les versions obsolètes
npm outdated

# Installer une nouvelle dépendance
npm install <package-name>

# Désinstaller une dépendance
npm uninstall <package-name>
```

---

## 🔍 Debugging

```bash
# Nettoyer le cache Next.js
rm -rf .next

# Réinstaller les node_modules
rm -rf node_modules package-lock.json
npm install

# Vérifier les erreurs TypeScript
npm run build

# Mode verbose
npm run dev -- --debug
```

---

## 🚀 Déploiement

### Vercel (Recommandé)

```bash
# Installer Vercel CLI
npm i -g vercel

# Login
vercel login

# Déployer
vercel

# Déployer en production
vercel --prod

# Voir les logs
vercel logs
```

### Netlify

```bash
# Installer Netlify CLI
npm i -g netlify-cli

# Login
netlify login

# Déployer
netlify deploy

# Déployer en production
netlify deploy --prod
```

---

## 🎨 Personnalisation

### Changer les couleurs

**Fichier** : `tailwind.config.ts`

```typescript
colors: {
  cyber: {
    primary: "#00ff41",    // Votre couleur
    secondary: "#0affef",  // Votre couleur
    accent: "#ff006e",     // Votre couleur
  },
}
```

### Modifier les traductions

**Fichiers** : 
- `messages/fr.json` (Français)
- `messages/en.json` (Anglais)

### Ajouter une nouvelle langue

1. Créer `messages/es.json` (exemple pour l'espagnol)
2. Modifier `middleware.ts` :
   ```typescript
   locales: ['en', 'fr', 'es'],
   ```
3. Modifier `app/[locale]/layout.tsx` :
   ```typescript
   const locales = ['en', 'fr', 'es'];
   ```

---

## 📸 Gestion des Images

```bash
# Ajouter une image
cp votre-image.jpg public/images/projects/

# Optimiser toutes les images (requiert imagemin)
npm i -g imagemin-cli
imagemin public/images/* --out-dir=public/images/optimized/
```

---

## 🧪 Tests & Qualité

```bash
# Vérifier TypeScript
npx tsc --noEmit

# Formatter le code (avec Prettier, si installé)
npx prettier --write .

# Analyser les performances
npm run build
npm start
# Ouvrir Chrome DevTools > Lighthouse

# Vérifier la taille du bundle
npm run build
# Regarder dans .next/
```

---

## 🔐 Variables d'Environnement

Créer un fichier `.env.local` :

```bash
# Analytics (optionnel)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# API Keys (si nécessaire)
NEXT_PUBLIC_API_URL=https://api.example.com
```

---

## 📊 Monitoring

### Analyser le build

```bash
# Installer l'analyseur
npm i @next/bundle-analyzer

# Analyser
ANALYZE=true npm run build
```

### Performance

```bash
# Lighthouse CI
npm i -g @lhci/cli
lhci autorun

# Mesurer le temps de build
time npm run build
```

---

## 🛠️ Maintenance

### Mise à jour Next.js

```bash
# Voir la version actuelle
npm list next

# Mettre à jour vers la dernière version
npm install next@latest react@latest react-dom@latest

# Vérifier les breaking changes
npm run build
```

### Nettoyage

```bash
# Supprimer les fichiers de build
rm -rf .next out

# Supprimer node_modules
rm -rf node_modules

# Supprimer le cache npm
npm cache clean --force
```

---

## 🐛 Dépannage Rapide

### Port déjà utilisé

```bash
# Changer le port
npm run dev -- -p 3001
```

### Module non trouvé

```bash
rm -rf node_modules package-lock.json .next
npm install
```

### Erreur de build

```bash
# Nettoyer et rebuilder
rm -rf .next
npm run build
```

### Images ne s'affichent pas

```bash
# Redémarrer le serveur
# Ctrl+C pour arrêter
npm run dev
```

### Problème de cache

```bash
# Vider tous les caches
rm -rf .next node_modules .npm
npm install
npm run dev
```

---

## 📚 Commandes Git (Bonus)

```bash
# Initialiser Git
git init

# Ajouter tous les fichiers
git add .

# Commit
git commit -m "Initial commit: Portfolio Charles Lantigua Jorge"

# Ajouter remote (GitHub)
git remote add origin https://github.com/votre-username/portfolio.git

# Push
git push -u origin main

# Créer une nouvelle branche
git checkout -b feature/nouvelle-fonctionnalite

# Voir le statut
git status

# Voir l'historique
git log --oneline
```

---

## 🎯 Raccourcis Pratiques

### Fichier `package.json` - Scripts personnalisés

Ajoutez ces scripts pour des raccourcis :

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "clean": "rm -rf .next node_modules",
  "fresh": "npm run clean && npm install && npm run dev",
  "deploy": "vercel --prod",
  "analyze": "ANALYZE=true npm run build"
}
```

Puis utilisez :
```bash
npm run fresh     # Réinstallation complète
npm run deploy    # Déployer en prod
npm run analyze   # Analyser le bundle
```

---

## 💻 Commandes Système

### Trouver le processus qui utilise le port 3000

```bash
# Mac/Linux
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Voir l'espace disque

```bash
# Taille du projet
du -sh .

# Taille de node_modules
du -sh node_modules

# Taille du build
du -sh .next
```

---

## 🎓 Ressources Utiles

```bash
# Documentation Next.js
open https://nextjs.org/docs

# Documentation Tailwind
open https://tailwindcss.com/docs

# Documentation Framer Motion
open https://www.framer.com/motion/

# React Bits
open https://reactbits.dev

# Vercel Dashboard
open https://vercel.com/dashboard
```

---

**💡 Astuce** : Créez un fichier `commands.sh` avec vos commandes favorites !

```bash
#!/bin/bash
# commands.sh - Mes commandes favorites

alias dev="npm run dev"
alias build="npm run build"
alias clean="rm -rf .next node_modules && npm install"
alias deploy="vercel --prod"
```

Puis : `source commands.sh` pour les activer !
