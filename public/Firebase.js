import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getDatabase, ref, get, child, onValue, onChildAdded, onChildRemoved, set, remove } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC0x1FHXHnonMUgy-weYwCQ12C2XIGp9bw",
  authDomain: "fir-rtc-6a542.firebaseapp.com",
  databaseURL: "https://fir-rtc-6a542-default-rtdb.firebaseio.com",
  projectId: "fir-rtc-6a542",
  storageBucket: "fir-rtc-6a542.appspot.com",
  messagingSenderId: "1096135183894",
  appId: "1:1096135183894:web:465ee90abf0ac1f1efaf37",
  measurementId: "G-1JQDQF8ZRV"
}

const app = initializeApp(firebaseConfig)

const db = getDatabase();
const dbRef = ref(db);

// get db ref for specific address
const getRefFromDb = (address) => {
  return ref(db, address);
}

const getMeeting = async (meetingId) => {
  return await get(child(dbRef, `meetings/${meetingId}`));
}

export {app, db, dbRef, getRefFromDb, getMeeting, onValue, onChildAdded, onChildRemoved, get, set, remove, child};