// lib/db.js
import { kv } from '@vercel/kv';

// Data siswa (nama, kelas, nilai, absensi, dst) - TANPA password di dalamnya
export async function getStudentData(nisn) {
  return kv.get(`student:${nisn}`);
}

export async function setStudentData(nisn, data) {
  return kv.set(`student:${nisn}`, data);
}

// Kredensial disimpan TERPISAH dari data akademik
export async function getStudentAuth(nisn) {
  return kv.get(`auth:${nisn}`); // { passwordHash, mustChangePassword }
}

export async function setStudentAuth(nisn, authRecord) {
  return kv.set(`auth:${nisn}`, authRecord);
}
