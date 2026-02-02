# 🖼️ Instrucciones para Reemplazar el Logo

## 📂 Pasos para usar tu imagen:

1. **Copia tu imagen**: `113914269_709619839892686_8995954519793435303_n.jpg`
2. **Pégala en**: `D:\AppServ\www\vinopormi\frontend\src\assets\`
3. **Renombra la imagen** a: `logo.jpg`
4. **Modifica el archivo** `D:\AppServ\www\vinopormi\frontend\src\assets\images.js`:

   Cambia:
   ```javascript
   export { default as logoImage } from './logo.jpg';
   export { default as logoPlaceholder } from './logo-placeholder.svg';
   ```

   Por:
   ```javascript
   export { default as logoImage } from './logo.jpg';
   ```

5. **Actualiza el Layout.js** para usar tu imagen:

   Cambia las líneas:
   ```javascript
   import { logoPlaceholder } from '@/assets/images';
   // ...
   <img src={logoPlaceholder} alt="Vinoteca Logo" className="w-6 h-6" />
   ```

   Por:
   ```javascript
   import { logoImage } from '@/assets/images';
   // ...
   <img src={logoImage} alt="Vinoteca Logo" className="w-6 h-6" />
   ```

6. **Actualiza el Login.js** para usar tu imagen:

   Cambia las líneas:
   ```javascript
   import { logoPlaceholder } from '@/assets/images';
   // ...
   <img src={logoPlaceholder} alt="Vinoteca Logo" className="w-12 h-12 object-contain" />
   ```

   Por:
   ```javascript
   import { logoImage } from '@/assets/images';
   // ...
   <img src={logoImage} alt="Vinoteca Logo" className="w-12 h-12 object-contain" />
   ```

## ✅ ¡Listo!

Tu imagen personalizada reemplazará el ícono de la copa de vino en:
- ✅ Header móvil (arriba a la izquierda)
- ✅ Sidebar del escritorio (arriba a la izquierda)
- ✅ Página de Login (círculo central)

## 📏 Tamaño recomendado:
- Ancho: 32-64px
- Alto: 32-64px
- Formato: JPG, PNG o SVG
- Fondo transparente recomendado