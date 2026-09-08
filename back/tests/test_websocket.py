import asyncio
import json

import pytest
import uvicorn
import websockets
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.mark.asyncio
async def test_websocket_full_lifecycle_and_events():
    # Lancement d'un serveur uvicorn de test en tâche de fond sur port dédié
    config = uvicorn.Config(app, host="127.0.0.1", port=8765, log_level="warning")
    server = uvicorn.Server(config)
    server_task = asyncio.create_task(server.serve())

    while not server.started:
        await asyncio.sleep(0.05)

    try:
        # 1. Création du salon via l'API HTTP
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://127.0.0.1:8765"
        ) as http_client:
            create_resp = await http_client.post(
                "/api/v1/rooms", json={"username": "Alice_Host"}
            )
            assert create_resp.status_code == 201
            data = create_resp.json()
            room_id = data["room_id"]
            host_token = data["host_token"]
            user_id = data["user_id"]

        # 2. Test connexion à un salon inexistant -> fermeture immédiate
        with pytest.raises(websockets.exceptions.WebSocketException):
            async with websockets.connect(
                "ws://127.0.0.1:8765/api/v1/rooms/unknown_room_999/ws?username=Intruder"
            ):
                pass

        # 3. Connexion de l'hôte (Alice)
        async with websockets.connect(
            f"ws://127.0.0.1:8765/api/v1/rooms/{room_id}/ws?username=Alice_Host&token={host_token}&user_id={user_id}"
        ) as ws_alice:
            alice_init = json.loads(await ws_alice.recv())
            assert alice_init["event"] == "ROOM_SYNC"
            assert alice_init["payload"]["room"]["room_id"] == room_id
            assert alice_init["payload"]["room"]["host_id"] == user_id

            # 4. Connexion d'un invité (Bob)
            async with websockets.connect(
                f"ws://127.0.0.1:8765/api/v1/rooms/{room_id}/ws?username=Bob_Guest"
            ) as ws_bob:
                bob_init = json.loads(await ws_bob.recv())
                assert bob_init["event"] == "ROOM_SYNC"

                # Alice reçoit la notification de connexion de Bob
                alice_notif = json.loads(await ws_alice.recv())
                assert alice_notif["event"] == "PARTICIPANT_JOINED"
                assert alice_notif["payload"]["user"]["username"] == "Bob_Guest"

                # 5. Alice lance la lecture avec le nouvel événement canonique (PLAY)
                await ws_alice.send(
                    json.dumps(
                        {
                            "event": "PLAY",
                            "payload": {"current_time": 42.5},
                        }
                    )
                )
                alice_play = json.loads(await ws_alice.recv())
                bob_play = json.loads(await ws_bob.recv())
                assert alice_play["event"] == "PLAYER_UPDATED"
                assert alice_play["payload"]["action"] == "PLAY"
                assert alice_play["payload"]["current_time"] == 42.5
                assert alice_play["payload"]["player"]["is_playing"] is True
                assert bob_play["event"] == "PLAYER_UPDATED"
                assert bob_play["payload"]["action"] == "PLAY"

                # 5b. Charlie rejoint alors que la vidéo tourne déjà
                async with websockets.connect(
                    f"ws://127.0.0.1:8765/api/v1/rooms/{room_id}/ws?username=Charlie_Late"
                ) as ws_charlie:
                    charlie_init = json.loads(await ws_charlie.recv())
                    assert charlie_init["event"] == "ROOM_SYNC"
                    assert charlie_init["payload"]["room"]["player"]["is_playing"] is True
                    assert charlie_init["payload"]["room"]["player"]["current_time"] >= 42.5
                    # Consommer la notification chez Alice et Bob
                    await ws_alice.recv()
                    await ws_bob.recv()
                # Consommer le départ de Charlie
                await ws_alice.recv()
                await ws_bob.recv()

                # 6. Alice change de média (CHANGE_MEDIA - YouTube)
                await ws_alice.send(
                    json.dumps(
                        {
                            "event": "CHANGE_MEDIA",
                            "payload": {
                                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                            },
                        }
                    )
                )
                alice_media = json.loads(await ws_alice.recv())
                bob_media = json.loads(await ws_bob.recv())
                assert alice_media["event"] == "PLAYER_UPDATED"
                assert alice_media["payload"]["media_id"] == "dQw4w9WgXcQ"
                assert bob_media["payload"]["media_id"] == "dQw4w9WgXcQ"

                # 6b. Alice envoie une URL invalide -> Erreur INVALID_MEDIA_URL
                await ws_alice.send(
                    json.dumps(
                        {
                            "event": "CHANGE_MEDIA",
                            "payload": {"url": "https://not-youtube.com/watch?v=123"},
                        }
                    )
                )
                alice_media_err = json.loads(await ws_alice.recv())
                assert alice_media_err["event"] == "ERROR"
                assert alice_media_err["payload"]["code"] == "INVALID_MEDIA_URL"

                # 7. Bob envoie un message de chat (CHAT_MESSAGE)
                await ws_bob.send(
                    json.dumps(
                        {
                            "event": "CHAT_MESSAGE",
                            "payload": {
                                "content": "Salut Alice ! <script>alert(1)</script>"
                            },
                        }
                    )
                )
                alice_chat = json.loads(await ws_alice.recv())
                bob_chat = json.loads(await ws_bob.recv())
                assert alice_chat["event"] == "CHAT_BROADCAST"
                assert alice_chat["payload"]["username"] == "Bob_Guest"
                assert "&lt;script&gt;" in alice_chat["payload"]["content"]
                assert bob_chat["event"] == "CHAT_BROADCAST"

                # 8. Bob envoie un Heartbeat (HEARTBEAT)
                client_timestamp = 1772450120000
                await ws_bob.send(
                    json.dumps(
                        {
                            "event": "HEARTBEAT",
                            "payload": {"client_sent_at": client_timestamp},
                        }
                    )
                )
                bob_ack = json.loads(await ws_bob.recv())
                assert bob_ack["event"] == "HEARTBEAT_ACK"
                assert bob_ack["payload"]["client_sent_at"] == client_timestamp

                # Alice reçoit la télémétrie de latence de Bob en direct
                alice_ping = json.loads(await ws_alice.recv())
                assert alice_ping["event"] == "PING_UPDATED"

                # 9. Alice verrouille le salon (UPDATE_SETTINGS)
                await ws_alice.send(
                    json.dumps(
                        {
                            "event": "UPDATE_SETTINGS",
                            "payload": {"is_locked": True},
                        }
                    )
                )
                alice_lock = json.loads(await ws_alice.recv())
                bob_lock = json.loads(await ws_bob.recv())
                assert alice_lock["event"] == "SETTINGS_UPDATED"
                assert bob_lock["payload"]["settings"]["is_locked"] is True

                # 10. Bob tente de lancer la lecture -> Erreur LOCKED
                await ws_bob.send(
                    json.dumps(
                        {
                            "event": "PLAY",
                            "payload": {"current_time": 99.0},
                        }
                    )
                )
                bob_err = json.loads(await ws_bob.recv())
                assert bob_err["event"] == "ERROR"
                assert bob_err["payload"]["code"] == "LOCKED"

                # 11. Bob tente d'envoyer un message surdimensionné (> 64KB) -> PAYLOAD_TOO_LARGE
                await ws_bob.send("x" * 70000)
                bob_size_err = json.loads(await ws_bob.recv())
                assert bob_size_err["event"] == "ERROR"
                assert bob_size_err["payload"]["code"] == "PAYLOAD_TOO_LARGE"

                # 12. Alice modifie une 2ème fois les permissions (capacité burst = 2, step 9 était la 1ère)
                await ws_alice.send(
                    json.dumps(
                        {
                            "event": "UPDATE_SETTINGS",
                            "payload": {"is_locked": False},
                        }
                    )
                )
                msg1_a = json.loads(await ws_alice.recv())
                msg1_b = json.loads(await ws_bob.recv())
                assert msg1_a["event"] == "SETTINGS_UPDATED"
                assert msg1_b["event"] == "SETTINGS_UPDATED"

                # 3ème tentative immédiate -> BLOQUÉ par le Rate Limiter (quota dépassé) !
                await ws_alice.send(
                    json.dumps(
                        {
                            "event": "UPDATE_SETTINGS",
                            "payload": {"is_locked": True},
                        }
                    )
                )
                alice_rate_err = json.loads(await ws_alice.recv())
                assert alice_rate_err["event"] == "ERROR"
                assert alice_rate_err["payload"]["code"] == "RATE_LIMITED"

            # 13. Bob s'est déconnecté -> Alice reçoit PARTICIPANT_LEFT
            alice_left = json.loads(await ws_alice.recv())
            assert alice_left["event"] == "PARTICIPANT_LEFT"
            assert alice_left["payload"]["username"] == "Bob_Guest"

    finally:
        server.should_exit = True
        await server_task
