/* ค่าตั้งค่า Firebase ของเว็บนี้ (ไม่ใช่รหัสลับ ใส่ในโค้ดได้ ความปลอดภัยอยู่ที่ firestore.rules)
   ได้จาก Firebase console → Project settings → Your apps → Web app → Config
   ถ้าเป็น null เว็บจะทำงานแบบ "โหมดทดลอง": ไม่มี Google จริง เก็บข้อมูลในเบราว์เซอร์นี้เท่านั้น */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyB6_nhSDbgTuAemi9YYw3JujC6UCUmvpv4",
  authDomain: "learn-web-by-wasqeetty.firebaseapp.com",
  projectId: "learn-web-by-wasqeetty",
  storageBucket: "learn-web-by-wasqeetty.firebasestorage.app",
  messagingSenderId: "424588834352",
  appId: "1:424588834352:web:b6f30a0a1276600b961ff5"
};
/* Web client ID ของ Google (ไม่ใช่รหัสลับ) ใช้ล็อกอินบนมือถือ/แท็บเล็ตผ่านหน้าต่างของ Google โดยตรง
   เพราะ Safari (iPhone/iPad) และ Chrome มือถือบล็อกการล็อกอินแบบเด้งข้ามโดเมนของ Firebase
   ต้องเพิ่ม https://wasqeetty.github.io ใน Authorized JavaScript origins ของ client นี้ใน Google Cloud console ก่อน */
window.GOOGLE_CLIENT_ID = "424588834352-dk5iicrlrdv1q795dpsdlhau5k88os63.apps.googleusercontent.com";
