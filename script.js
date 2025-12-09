
let registered = 0;
const target = 800;

function updateCounts() {
    document.getElementById("registeredCount").innerText = registered;
    document.getElementById("remainingCount").innerText = target - registered;
}

function registerUser() {
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();

    if (!name || !phone) return;

    registered++;
    updateCounts();

    document.getElementById("name").value = "";
    document.getElementById("phone").value = "";
}

updateCounts();
