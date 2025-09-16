import { io } from "socket.io-client";

const BACKEND = import.meta.env.VITE_BACKEND || "https://focus-proctoring-backend.onrender.com";
const socket = io(BACKEND, { autoConnect: true });

export default socket;
