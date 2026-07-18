# ChoreStar: Echo Show 15 Chores Dashboard

A beautiful, glassmorphic family dashboard designed specifically for the **Amazon Echo Show 15** (1920x1080 landscape display). This app allows you to track and manage chores for kids and parents, award points, and let kids claim custom rewards.

---

## Key Features

- 👤 **Family Members & Roles**:
  - **Kids (Kid 1 & Kid 2)**: Earn points, track chore completion, and can spend points in the Claim Rewards section.
  - **Parents (Parent 1 & Parent 2)**: Simple daily chore list for parental duties, styled differently (slate theme), with points and reward elements hidden.
- 📅 **Day-of-Week Repeating Chores**: Add chores that repeat on specific days (e.g. "Put out trash bins" on Tuesdays & Fridays).
- 📋 **Interactive Touch Targets**: Large touch-friendly checkboxes and rows for effortless kid interaction.
- 🔄 **Auto-Resetting**: Daily chores automatically reset every morning. Weekly chores persist until checked off and reset on Monday morning.
- ⏱️ **Integrated Central Clock**: Side-panel digital clock and date, plus family-wide progress statistics.
- ⚙️ **Local Administration**: Add, edit, or delete members, chores, and rewards directly on the dashboard. State is fully persistent in local storage.
- ☀️ **Screen Wake Lock**: Bottom left toggle to keep your Echo Show 15 screen from dimming/sleeping.
- 🎉 **Celebrations**: Confetti pops upon completion, and screen-wide celebrations when kids finish all daily chores!

---

## Deploying to docker1 Host (Recommended)

All stack files have been successfully staged in your remote home directory at `house@docker1:~/chorestar_docker1_gz/`.

### 1. Move Stack and Start Container
SSH into your `docker1` server and run the following commands to move the stack into `/opt/stacks` and spin up the container:
```bash
# Move from staged home directory to stacks directory
sudo mv ~/chorestar_docker1_gz /opt/stacks/chorestar_docker1_gz

# Change directory
cd /opt/stacks/chorestar_docker1_gz

# Start the stack (this builds the Nginx image and exposes port 8282)
sudo docker compose up -d
```

### 2. Configure Traefik Dynamic Reverse Proxy
To make the dashboard accessible via **`https://chores.groundzero.lan`**, edit your Traefik dynamic configuration file (located at `/opt/stacks/traefik_groundzero/dynamic/dynamic.yml`) and insert the following:

#### Add under `http: routers:`:
```yaml
    chorestar_redirect:
       rule: "Host(`chores.groundzero.lan`)"
       service: chorestar
       entryPoints:
         - web
       middlewares: "https-redirect"

    chorestar:
       rule: "Host(`chores.groundzero.lan`)"
       service: chorestar
       entryPoints:
         - websecure
       tls:
         certResolver: "privatelab-ca"
```

#### Add under `http: services:`:
```yaml
    chorestar:
      loadBalancer:
        servers:
          - url: "http://chorestar:80/"
```
*(Since `compose.yml` sets the container name to `chorestar` and connects it to the `groundzero_lan` network, Traefik will be able to resolve and route directly to it on port 80).*

---

## Local Development (Alternative)

If you wish to run it locally on your development machine first:
1. Navigate to the project directory containing `docker-compose.yml`.
2. Run:
   ```bash
   docker compose up -d
   ```
3. Access the local web server at `http://localhost:8080`.

---

## How to Set Up on Echo Show 15

1. **Open Silk Browser**: Say: *"Alexa, open Silk browser"*.
2. **Navigate to the App**: Enter your reverse proxied URL `https://chores.groundzero.lan` (or the direct port URL `http://<docker1-ip>:8282`).
3. **Bookmark It**: Save the page as a Silk bookmark for quick loading.
4. **Keep Screen On**: Click **"Keep Screen On"** on the bottom left sidebar. This activates the browser's Wake Lock API to prevent the Echo Show from sleeping.
5. **Initial Setup**: Tap **Manage Chores** on the bottom left settings panel to customize tasks or add rewards. The app comes pre-seeded with profile cards for Kid 1, Kid 2, Parent 1, and Parent 2.
