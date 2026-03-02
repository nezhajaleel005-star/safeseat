// --- State Management ---
const state = {
    currentUser: JSON.parse(localStorage.getItem('user')) || null,
    bookings: JSON.parse(localStorage.getItem('bookings')) || [],
    complaints: JSON.parse(localStorage.getItem('complaints')) || [],
    violations: JSON.parse(localStorage.getItem('violations')) || [],
    buses: [
        { id: "TX-101", route: "Downtown Express", seats: 5, totalSeats: 12, time: "10:30 AM", type: "Low-Floor Accessible" },
        { id: "TX-205", route: "Airport Shuttle", seats: 2, totalSeats: 15, time: "11:15 AM", type: "Priority Seating" },
        { id: "TX-309", route: "City Circle", seats: 8, totalSeats: 20, time: "12:00 PM", type: "Inclusive Transit" },
        { id: "TX-440", route: "Suburban Link", seats: 0, totalSeats: 10, time: "01:00 PM", type: "Accessible" }
    ]
};

const app = {
    init() {
        lucide.createIcons();
        router.init();
        this.updateNav();
        this.bindGlobalEvents();
        this.setupVoiceAssistant();
        this.calculateFines();
    },

    updateNav() {
        const userInfo = document.getElementById('user-info');
        const displayName = document.getElementById('display-name');
        if (state.currentUser) {
            userInfo.classList.remove('hidden');
            displayName.textContent = `Hello, ${state.currentUser.name}`;
            document.getElementById('btn-logout').onclick = () => {
                localStorage.removeItem('user');
                state.currentUser = null;
                location.reload();
            };
        } else {
            userInfo.classList.add('hidden');
        }
    },

    bindGlobalEvents() {
        document.getElementById('nav-logo').onclick = () => router.navigate('landing');
        window.onclick = (e) => {
            if (e.target.matches('.btn-book') || e.target.closest('.btn-book')) {
                const btn = e.target.closest('.btn-book') || e.target;
                this.bookSeat(btn.dataset.id);
            }
        };
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'v') this.toggleVoiceAssistant();
        });
    },

    toast(msg, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.className = `toast show ${type}`;
        this.say(msg);
        setTimeout(() => toast.classList.add('hidden'), 3000);
    },

    bookSeat(busId) {
        if (!state.currentUser) {
            this.toast('Please login to book a seat', 'error');
            router.navigate('login');
            return;
        }

        const bus = state.buses.find(b => b.id === busId);
        if (bus.seats <= 0) {
            this.toast('No seats available', 'error');
            return;
        }

        const newBooking = { id: Date.now(), user: state.currentUser.name, busId, route: bus.route, time: bus.time };
        state.bookings.push(newBooking);
        bus.seats--;
        localStorage.setItem('bookings', JSON.stringify(state.bookings));
        this.toast(`Seat reserved for ${bus.route}`);
        router.navigate('dashboard');
    },

    handleComplaint(data) {
        const complaint = { ...data, id: Date.now(), status: 'pending', date: new Date().toLocaleDateString() };
        state.complaints.push(complaint);
        localStorage.setItem('complaints', JSON.stringify(state.complaints));

        if (data.type === 'seat_denied' || data.type === 'no_stop') {
            const fine = {
                id: Date.now() + 1,
                busId: data.busId,
                reason: data.type === 'seat_denied' ? 'Seat Denial' : 'Skipped Stop',
                amount: data.type === 'seat_denied' ? 150 : 200,
                assignedTo: data.type === 'seat_denied' ? 'Conductor' : 'Driver'
            };
            state.violations.push(fine);
            localStorage.setItem('violations', JSON.stringify(state.violations));
            this.toast('Complaint filed. Automatic fine imposed.', 'error');
        } else {
            this.toast('Complaint submitted.');
        }
        router.navigate('dashboard');
    },

    calculateFines() {
        const total = state.violations.reduce((acc, v) => acc + v.amount, 0);
        const el = document.getElementById('total-fines');
        if (el) el.textContent = `$${total}`;
    },

    setupVoiceAssistant() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        this.recognition = new SpeechRecognition();
        this.recognition.onstart = () => document.getElementById('voice-overlay').classList.remove('hidden');
        this.recognition.onresult = (e) => {
            const cmd = e.results[0][0].transcript.toLowerCase();
            document.getElementById('voice-transcript').textContent = `"${cmd}"`;
            this.processVoiceCommand(cmd);
        };
        this.recognition.onend = () => setTimeout(() => document.getElementById('voice-overlay').classList.add('hidden'), 1000);
        document.getElementById('voice-trigger').onclick = () => this.toggleVoiceAssistant();
    },

    toggleVoiceAssistant() { this.recognition && this.recognition.start(); },

    processVoiceCommand(cmd) {
        if (cmd.includes('book')) router.navigate('dashboard');
        else if (cmd.includes('login')) router.navigate('login');
        else if (cmd.includes('complain')) router.navigate('complaint');
        else if (cmd.includes('home')) router.navigate('landing');
        else this.say("Command not recognized.");
    },

    say(text) { window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)); }
};

const router = {
    content: null,
    init() { this.content = document.getElementById('main-content'); this.navigate(state.currentUser ? 'dashboard' : 'landing'); },
    navigate(id) {
        const template = document.getElementById(`tpl-${id}`);
        if (!template) return;
        this.content.style.opacity = '0';
        setTimeout(() => {
            this.content.innerHTML = '';
            this.content.appendChild(template.content.cloneNode(true));
            lucide.createIcons();
            this.initSection(id);
            this.content.style.opacity = '1';
        }, 200);
    },
    initSection(id) {
        if (id === 'login') this.setupLogin();
        if (id === 'register') this.setupRegister();
        if (id === 'dashboard') this.renderBuses();
        if (id === 'complaint') this.setupComplaint();
        if (id === 'admin') this.renderAdmin();
    },
    setupLogin() {
        document.getElementById('login-form').onsubmit = (e) => {
            e.preventDefault();
            const users = JSON.parse(localStorage.getItem('users')) || [];
            const user = users.find(u => u.email === e.target[0].value);
            if (user) {
                state.currentUser = user;
                localStorage.setItem('user', JSON.stringify(user));
                app.updateNav();
                router.navigate(user.category === 'admin' ? 'admin' : 'dashboard');
            } else app.toast('User not found', 'error');
        };
    },
    setupRegister() {
        document.getElementById('register-form').onsubmit = (e) => {
            e.preventDefault();
            const newUser = { name: e.target[0].value, email: e.target[1].value, category: e.target[2].value, pass: e.target[3].value };
            const users = JSON.parse(localStorage.getItem('users')) || [];
            users.push(newUser);
            localStorage.setItem('users', JSON.stringify(users));
            app.toast('Registered!');
            router.navigate('login');
        };
    },
    renderBuses() {
        const list = document.getElementById('transport-list');
        list.innerHTML = state.buses.map(bus => `
            <div class="glass-card bus-card">
                <div class="bus-header" style="display:flex; justify-content:space-between; margin-bottom:1.5rem;">
                    <div class="bus-icon-bg"><i data-lucide="bus-front"></i></div>
                    <span class="status-pill ${bus.seats > 0 ? 'status-available' : 'status-limited'}">${bus.seats} Left</span>
                </div>
                <h3 style="font-size:1.8rem; margin-bottom:0.5rem;">${bus.route}</h3>
                <div class="tag" style="margin-bottom:2rem;"><i data-lucide="route" style="width:14px;"></i> ${bus.id}</div>
                <button class="btn-primary full-width btn-book" data-id="${bus.id}" ${bus.seats === 0 ? 'disabled' : ''}>
                    ${bus.seats > 0 ? 'Book Priority Seat' : 'Full'}
                    <i data-lucide="chevron-right"></i>
                </button>
            </div>
        `).join('');
        lucide.createIcons();
    },
    setupComplaint() {
        document.getElementById('complaint-form').onsubmit = (e) => {
            e.preventDefault();
            app.handleComplaint({
                type: document.getElementById('issue-type').value,
                busId: document.getElementById('bus-id').value,
                details: document.getElementById('issue-details').value
            });
        };
    },
    renderAdmin() {
        app.calculateFines();
        document.getElementById('admin-bookings-list').innerHTML = state.bookings.map(b => `<div class="list-item"><span>${b.user}</span> <span>${b.busId}</span></div>`).join('');
        document.getElementById('admin-violations-list').innerHTML = state.violations.map(v => `<div class="list-item" style="border-left:4px solid var(--danger);"><span>$${v.amount}</span> <span>${v.assignedTo}: ${v.reason}</span></div>`).join('');
        lucide.createIcons();
    }
};

app.init();
