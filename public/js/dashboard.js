document.addEventListener('DOMContentLoaded', () => {
    const btnCreateEvent = document.getElementById('btnCreateEvent');
    const eventLoading = document.getElementById('eventLoading');
    const eventDetails = document.getElementById('eventDetails');
    const btnResend = document.getElementById('btnResend');
    
    if (btnCreateEvent) {
        btnCreateEvent.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to create a new Duel Event? This will generate codes and send DMs to all registered users.')) return;
            
            btnCreateEvent.disabled = true;
            eventDetails.style.display = 'none';
            eventLoading.style.display = 'block';

            try {
                const response = await fetch('/api/events/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert(`Event Created Successfully!\nDMs Sent: ${data.stats.dmSuccess}\nDMs Failed: ${data.stats.dmFail}`);
                    window.location.reload();
                } else {
                    alert(`Failed to create event: ${data.error}`);
                    window.location.reload();
                }
            } catch (error) {
                console.error(error);
                alert('An error occurred.');
                window.location.reload();
            }
        });
    }

    if (btnResend) {
        btnResend.addEventListener('click', async () => {
            const discordId = document.getElementById('resendDiscordId').value.trim();
            const resendStatus = document.getElementById('resendStatus');
            
            if (!discordId) {
                resendStatus.innerHTML = '<span style="color: var(--danger);">Please enter a Discord ID.</span>';
                return;
            }

            btnResend.disabled = true;
            resendStatus.innerHTML = '<span style="color: var(--accent-cyan);"><i class="fa-solid fa-spinner fa-spin"></i> Sending...</span>';

            try {
                const response = await fetch('/api/codes/resend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ discordId })
                });

                const data = await response.json();

                if (data.success) {
                    if (data.dmSuccess) {
                        resendStatus.innerHTML = '<span style="color: var(--success);"><i class="fa-solid fa-check"></i> Code sent successfully via DM!</span>';
                    } else {
                        resendStatus.innerHTML = '<span style="color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Code generated but failed to send DM. Check bot permissions or user privacy settings.</span>';
                    }
                } else {
                    resendStatus.innerHTML = `<span style="color: var(--danger);"><i class="fa-solid fa-circle-xmark"></i> ${data.error}</span>`;
                }
            } catch (error) {
                resendStatus.innerHTML = '<span style="color: var(--danger);">An error occurred.</span>';
            } finally {
                btnResend.disabled = false;
                document.getElementById('resendDiscordId').value = '';
            }
        });
    }

    const deleteBtns = document.querySelectorAll('.btn-delete-evt');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm(`Are you sure you want to delete this Event? This will also delete all associated access codes and unregister the users who participated in it.`)) {
                e.preventDefault();
                return;
            }
        });
    });

    document.querySelectorAll(".btn-create-code").forEach(btn => {
        btn.addEventListener("click", function() {
            const eventId = this.getAttribute("data-id");
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
            this.disabled = true;

            fetch(`/api/codes/manual/${eventId}`, { method: "POST" })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        navigator.clipboard.writeText(data.code).then(() => {
                            this.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                            this.style.color = 'var(--success)';
                            this.style.borderColor = 'var(--success)';
                            setTimeout(() => {
                                this.innerHTML = originalText;
                                this.disabled = false;
                                this.style.color = '';
                                this.style.borderColor = '';
                            }, 3000);
                        });
                    } else {
                        alert("Error generating code: " + data.error);
                        this.innerHTML = originalText;
                        this.disabled = false;
                    }
                })
                .catch(err => {
                    console.error("Error:", err);
                    alert("An error occurred.");
                    this.innerHTML = originalText;
                    this.disabled = false;
                });
        });
    });
});

function copyRoomLink() {
    const copyText = document.getElementById("roomLinkInput");
    if (copyText) {
        copyText.select();
        copyText.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(copyText.value);
        
        // Show temporary tooltip or feedback if needed
        const btn = document.querySelector('.btn-copy');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 2000);
    }
}
