# 📸 Guide : Comment Ajouter Vos Images

## 🎯 Vue d'ensemble

Votre portfolio a **6 emplacements pour images** :
- 1 photo professionnelle
- 5 images de projets

Tous les emplacements ont des **placeholders** qui s'affichent en attendant vos images.

---

## 📁 Étape 1 : Préparer vos images

### Photo Professionnelle
- **Nom du fichier** : `profile.jpg` ou `profile.png`
- **Taille recommandée** : 400x400px (carré)
- **Format** : JPG ou PNG
- **Qualité** : Haute résolution
- **Style** : Fond professionnel ou fond uni
- **Poids** : < 500 KB

### Images des Projets

| Projet | Nom du fichier | Taille | Type |
|--------|----------------|--------|------|
| Security Scanner | `security-scanner.png` | 800x400px | Featured |
| Encryptor | `encryptor.png` | 800x400px | Featured |
| SABER | `saber.png` | 800x400px | Featured |
| IoC App | `ioc-app.png` | 600x400px | Normal |
| Warhammer 40k | `warhammer.png` | 600x400px | Normal |

**💡 Astuce** : Utilisez des screenshots de vos projets, ou créez des mockups avec des outils comme Figma.

---

## 📂 Étape 2 : Placer les images

### Photo professionnelle
```bash
# Copiez votre photo ici :
/public/images/hero/profile.jpg
```

### Images de projets
```bash
# Copiez vos images de projets ici :
/public/images/projects/security-scanner.png
/public/images/projects/encryptor.png
/public/images/projects/saber.png
/public/images/projects/ioc-app.png
/public/images/projects/warhammer.png
```

---

## 🔧 Étape 3 : Activer les images dans le code

### Pour la photo professionnelle

**Fichier** : `/components/sections/AboutSection.tsx`

**Ligne 42** - Trouvez cette section :
```tsx
<div className="relative image-placeholder rounded-lg h-full w-full overflow-hidden bg-cyber-dark/50 border-2 border-cyber-primary/50">
  {/* Placeholder text */}
  <div className="absolute inset-0 flex flex-col items-center justify-center text-cyber-primary/50">
    {/* ... placeholder content ... */}
  </div>
  {/* Replace with: <Image src="/images/hero/profile.jpg" alt="Charles Lantigua Jorge" fill className="object-cover" /> */}
</div>
```

**Remplacez par** :
```tsx
<div className="relative rounded-lg h-full w-full overflow-hidden">
  <Image 
    src="/images/hero/profile.jpg" 
    alt="Charles Lantigua Jorge" 
    fill 
    className="object-cover" 
  />
</div>
```

---

### Pour les images de projets

**Fichier** : `/components/sections/ProjectsSection.tsx`

**Lignes 11-49** - Trouvez chaque projet et décommentez la ligne `imagePath` :

**Avant** :
```tsx
{
  title: t('items.0.title'),
  description: t('items.0.description'),
  tech: t('items.0.tech').split(','),
  github: t('items.0.github'),
  featured: true,
  // imagePath: '/images/projects/security-scanner.png', // ← Ligne commentée
},
```

**Après** :
```tsx
{
  title: t('items.0.title'),
  description: t('items.0.description'),
  tech: t('items.0.tech').split(','),
  github: t('items.0.github'),
  featured: true,
  imagePath: '/images/projects/security-scanner.png', // ← Ligne décommentée ✅
},
```

**Répétez pour les 5 projets** :
- Ligne ~26 : Security Scanner
- Ligne ~33 : Encryptor  
- Ligne ~40 : SABER
- Ligne ~47 : IoC App
- Ligne ~54 : Warhammer

---

## ✅ Étape 4 : Vérifier le résultat

1. **Lancer le serveur** :
   ```bash
   npm run dev
   ```

2. **Ouvrir le navigateur** :
   ```
   http://localhost:3000
   ```

3. **Vérifier** :
   - ✅ Photo dans la section "About"
   - ✅ Images dans les cartes de projets
   - ✅ Pas d'erreur dans la console

---

## 🎨 Options de Personnalisation

### Changer le format de la photo
Si votre photo n'est pas carrée, modifiez la classe `aspect-square` :
```tsx
<div className="relative w-full aspect-video max-w-md mx-auto">
  {/* pour format 16:9 */}
</div>
```

### Ajouter un effet de zoom au hover
Dans `/components/ui/ProjectCard.tsx`, la classe est déjà présente :
```tsx
className="object-cover transition-transform duration-500 group-hover:scale-110"
```

### Optimiser le poids des images
```bash
# Installer un outil de compression
npm install -g imagemin-cli

# Compresser une image
imagemin profile.jpg --plugin=jpeg > profile-optimized.jpg
```

---

## 🚨 Dépannage

### ❌ "Image not found" ou 404
**Cause** : Le chemin du fichier est incorrect

**Solution** :
1. Vérifiez que le fichier existe dans `/public/images/`
2. Vérifiez l'orthographe exacte du nom
3. Vérifiez l'extension (.jpg, .png, .jpeg)

### ❌ L'image ne s'affiche pas
**Cause** : Next.js cache les images

**Solution** :
```bash
# Arrêter le serveur (Ctrl+C)
rm -rf .next
npm run dev
```

### ❌ L'image est déformée
**Cause** : Mauvaises proportions

**Solution** :
Changez `object-cover` en `object-contain` :
```tsx
<Image ... className="object-contain" />
```

---

## 📊 Checklist Finale

- [ ] Photo professionnelle ajoutée dans `/public/images/hero/`
- [ ] 5 images de projets ajoutées dans `/public/images/projects/`
- [ ] Code décommenté dans `AboutSection.tsx`
- [ ] Code décommenté dans `ProjectsSection.tsx` (5 fois)
- [ ] Serveur relancé
- [ ] Images visibles sur le site
- [ ] Aucune erreur dans la console

---

## 💡 Besoin d'inspiration ?

### Où trouver/créer des images de projets ?

1. **Screenshots directs** : Faites des captures d'écran de vos projets
2. **Mockups** : Utilisez [Figma](https://figma.com) ou [Canva](https://canva.com)
3. **Code screenshots** : [Carbon](https://carbon.now.sh) pour de beaux screenshots de code
4. **Terminal screenshots** : [Terminalizer](https://terminalizer.com) pour capturer le terminal
5. **Banques d'images** : [Unsplash](https://unsplash.com) ou [Pexels](https://pexels.com) pour des placeholders

### Pour la photo professionnelle

1. **Studio photo** : Professionnel recommandé
2. **Smartphone** : Fond uni + bonne lumière naturelle
3. **IA** : [This Person Does Not Exist](https://thispersondoesnotexist.com) (temporaire)
4. **Avatar** : [Avataaars](https://getavataaars.com) pour un style illustré

---

**🎉 C'est tout ! Votre portfolio sera magnifique avec vos images !**
