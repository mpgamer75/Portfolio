# 🚀 Guide de Démarrage Rapide

## Installation et lancement (3 commandes !)

```bash
# 1. Aller dans le dossier
cd portfolio

# 2. Installer les dépendances
npm install

# 3. Lancer le projet
npm run dev
```

Votre portfolio sera accessible sur **http://localhost:3000** 🎉

## 📸 Ajouter vos images

### 1. Photo professionnelle
- Placez votre photo dans `/public/images/hero/profile.jpg`
- Recommandé : 400x400px
- Puis décommentez la ligne 42 dans `/components/sections/AboutSection.tsx`

### 2. Images des projets
Placez vos images dans `/public/images/projects/` :
- `security-scanner.png` (800x400px pour les featured)
- `encryptor.png` (800x400px pour les featured)
- `saber.png` (800x400px pour les featured)
- `ioc-app.png` (600x400px)
- `warhammer.png` (600x400px)

Puis décommentez les lignes `imagePath` dans `/components/sections/ProjectsSection.tsx` (lignes 26-49)

## 🎨 Changer les couleurs

Modifiez `tailwind.config.ts` :
```typescript
cyber: {
  primary: "#00ff41",    // Vert terminal (changez cette couleur)
  secondary: "#0affef",  // Cyan
  accent: "#ff006e",     // Rose/Rouge
}
```

## 🌐 Changer de langue

Cliquez sur le bouton FR/EN dans la navigation !

## 📝 Modifier le contenu

Éditez les fichiers :
- `/messages/fr.json` pour le français
- `/messages/en.json` pour l'anglais

## 🚀 Déployer sur Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer (suivez les instructions)
vercel
```

## ❓ Problèmes ?

### "Module not found"
```bash
rm -rf node_modules package-lock.json
npm install
```

### Port 3000 déjà utilisé
```bash
npm run dev -- -p 3001
```

### Erreur TypeScript
```bash
npm run build
```

---

**Besoin d'aide ?** Consultez le README.md complet !
