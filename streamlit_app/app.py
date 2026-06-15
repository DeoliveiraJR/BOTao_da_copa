from __future__ import annotations

from datetime import datetime
from io import BytesIO
import json
import os
from pathlib import Path
from typing import Any

import pandas as pd
from PIL import Image, ImageDraw, ImageFont
import requests
import streamlit as st

st.set_page_config(
    page_title="BOTao da Copa 2026",
    page_icon="🏆",
    layout="wide",
    initial_sidebar_state="collapsed",
)

ASSETS_DIR = Path(__file__).resolve().parent / "assets"
AVATAR_STORE = ASSETS_DIR / "avatar_profiles.json"


def default_api_base_url() -> str:
    if "API_BASE_URL" in st.secrets:
        return str(st.secrets["API_BASE_URL"]).rstrip("/")
    return os.getenv("API_BASE_URL", "http://localhost:3000").rstrip("/")


def apply_custom_css() -> None:
    st.markdown(
        """
        <style>
        :root {
          --retro-bg: #fff3d1;
          --retro-accent: #e6b200;
          --retro-accent-2: #0f3d3e;
          --retro-panel: #fffaf0;
          --retro-text: #1f2933;
          --retro-danger: #a9333a;
        }
        .stApp {
          background:
            radial-gradient(circle at 20% 20%, rgba(230,178,0,.25) 0%, transparent 30%),
            radial-gradient(circle at 85% 10%, rgba(15,61,62,.22) 0%, transparent 35%),
            linear-gradient(180deg, #fff7dc 0%, #fff2cc 100%);
          color: var(--retro-text);
        }
        h1, h2, h3 {
          color: #0f3d3e;
          letter-spacing: .3px;
        }
        .retro-hero {
          border: 2px solid #0f3d3e;
          border-radius: 16px;
          background: linear-gradient(135deg, #fff9e6 0%, #ffe69b 100%);
          padding: 1rem;
          box-shadow: 0 8px 20px rgba(0,0,0,.10);
          margin-bottom: 1rem;
        }
        .retro-card {
          border: 1px solid #d7c081;
          border-radius: 14px;
          background: var(--retro-panel);
          padding: .8rem 1rem;
          box-shadow: 0 4px 12px rgba(0,0,0,.06);
        }
        .retro-sub {
          color: #5b6b7a;
          font-size: .95rem;
        }
        @media (max-width: 900px) {
          .block-container {
            padding-top: 1rem;
            padding-left: .7rem;
            padding-right: .7rem;
          }
          h1 { font-size: 1.6rem; }
          h2 { font-size: 1.3rem; }
          .retro-hero { padding: .8rem; }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def ensure_assets_dir() -> None:
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)


def load_avatar_profiles() -> dict[str, str]:
    ensure_assets_dir()
    if not AVATAR_STORE.exists():
        return {}
    try:
        return json.loads(AVATAR_STORE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_avatar_profiles(data: dict[str, str]) -> None:
    ensure_assets_dir()
    AVATAR_STORE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def api_get(base_url: str, timeout_seconds: int, path: str) -> dict[str, Any]:
    resp = requests.get(f"{base_url}{path}", timeout=timeout_seconds)
    resp.raise_for_status()
    return resp.json()


def api_post(base_url: str, timeout_seconds: int, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    resp = requests.post(f"{base_url}{path}", json=payload or {}, timeout=timeout_seconds)
    resp.raise_for_status()
    return resp.json()


def safe_fetch(base_url: str, timeout_seconds: int, path: str, fallback_key: str) -> tuple[list[dict[str, Any]], str | None]:
    try:
        data = api_get(base_url, timeout_seconds, path)
        return data.get(fallback_key, []), None
    except Exception as exc:  # noqa: BLE001
        return [], str(exc)


def to_df(items: list[dict[str, Any]]) -> pd.DataFrame:
    return pd.DataFrame(items) if items else pd.DataFrame()


def fmt_dt(value: Any) -> str:
    if value is None or value == "":
        return "-"
    dt = pd.to_datetime(value, errors="coerce", utc=True)
    if pd.isna(dt):
        return "-"
    return dt.tz_convert("America/Sao_Paulo").strftime("%d/%m/%Y %H:%M")


FLAG_MAP = {
    "BRASIL": "🇧🇷",
    "ARGENTINA": "🇦🇷",
    "ESPANHA": "🇪🇸",
    "CABO VERDE": "🇨🇻",
    "BELGICA": "🇧🇪",
    "EGITO": "🇪🇬",
    "ARABIA SAUDITA": "🇸🇦",
    "URUGUAI": "🇺🇾",
    "IRA": "🇮🇷",
    "NOVA ZELANDIA": "🇳🇿",
    "CANADA": "🇨🇦",
    "BOSNIA E HERZEGOVINA": "🇧🇦",
    "ESTADOS UNIDOS": "🇺🇸",
    "PARAGUAI": "🇵🇾",
    "CATAR": "🇶🇦",
    "SUICA": "🇨🇭",
    "HAITI": "🇭🇹",
    "ESCOCIA": "🏴",
    "AUSTRALIA": "🇦🇺",
    "TURQUIA": "🇹🇷",
    "ALEMANHA": "🇩🇪",
    "CURACAO": "🇨🇼",
    "PAISES BAIXOS": "🇳🇱",
    "JAPAO": "🇯🇵",
    "COSTA DO MARFIM": "🇨🇮",
    "EQUADOR": "🇪🇨",
    "SUECIA": "🇸🇪",
    "TUNISIA": "🇹🇳",
    "MARROCOS": "🇲🇦",
}


def normalize_team(value: str) -> str:
    return (
        str(value)
        .upper()
        .replace("Á", "A")
        .replace("À", "A")
        .replace("Ã", "A")
        .replace("Â", "A")
        .replace("É", "E")
        .replace("Ê", "E")
        .replace("Í", "I")
        .replace("Ó", "O")
        .replace("Õ", "O")
        .replace("Ô", "O")
        .replace("Ú", "U")
        .replace("Ç", "C")
        .strip()
    )


def team_with_flag(team: str) -> str:
    normalized = normalize_team(team)
    flag = FLAG_MAP.get(normalized, "🏟️")
    return f"{flag} {team}"


def build_predictions_view(
    predictions_df: pd.DataFrame,
    ranking_df: pd.DataFrame,
    games_df: pd.DataFrame,
) -> pd.DataFrame:
    if predictions_df.empty:
        return predictions_df

    name_map: dict[str, str] = {}
    if not ranking_df.empty:
        for _, row in ranking_df.iterrows():
            pid = str(row.get("participantId", "")).strip()
            if pid:
                name_map[pid] = str(row.get("name") or pid)

    game_map: dict[str, dict[str, Any]] = {}
    if not games_df.empty:
        for _, row in games_df.iterrows():
            game_map[str(row.get("id", ""))] = {
                "home": str(row.get("homeTeam", "")),
                "away": str(row.get("awayTeam", "")),
                "date": row.get("dateTime"),
            }

    display = predictions_df.copy()
    display["participantName"] = display["participantId"].astype(str).map(name_map).fillna(display["participantId"].astype(str))

    def match_label(row: pd.Series) -> str:
        game = game_map.get(str(row.get("gameId", "")), {})
        home = game.get("home") or row.get("homeTeam", "Time A")
        away = game.get("away") or row.get("awayTeam", "Time B")
        return f"{team_with_flag(str(home))} x {team_with_flag(str(away))}"

    def game_date(row: pd.Series) -> str:
        game = game_map.get(str(row.get("gameId", "")), {})
        raw = game.get("date") or row.get("createdAt")
        return fmt_dt(raw)

    display["match"] = display.apply(match_label, axis=1)
    display["gameDate"] = display.apply(game_date, axis=1)
    display["palpite"] = display.apply(
        lambda r: f"{int(r.get('homeGoals', 0))} x {int(r.get('awayGoals', 0))}", axis=1
    )
    display["updatedAtFmt"] = display["updatedAt"].apply(fmt_dt)
    return display


def build_results_view(results_df: pd.DataFrame, games_df: pd.DataFrame) -> pd.DataFrame:
    if results_df.empty:
        return results_df
    game_map = {}
    if not games_df.empty:
        game_map = {
            str(r.get("id", "")): {
                "home": str(r.get("homeTeam", "")),
                "away": str(r.get("awayTeam", "")),
                "date": r.get("dateTime"),
            }
            for _, r in games_df.iterrows()
        }

    view = results_df.copy()

    def match_label(row: pd.Series) -> str:
        game = game_map.get(str(row.get("gameId", "")), {})
        return f"{team_with_flag(str(game.get('home', 'Time A')))} x {team_with_flag(str(game.get('away', 'Time B')))}"

    view["match"] = view.apply(match_label, axis=1)
    view["placar"] = view.apply(
        lambda r: f"{int(r.get('homeGoalsManual', 0))} x {int(r.get('awayGoalsManual', 0))}", axis=1
    )
    view["dataJogo"] = view["gameId"].astype(str).map(lambda gid: fmt_dt(game_map.get(gid, {}).get("date")))
    return view


def make_retro_card(title: str, subtitle: str, lines: list[str]) -> bytes:
    image = Image.new("RGB", (1080, 1350), color="#fff3d1")
    draw = ImageDraw.Draw(image)
    font_title = ImageFont.load_default()
    font_body = ImageFont.load_default()

    draw.rounded_rectangle((36, 36, 1044, 1314), radius=28, fill="#fffaf0", outline="#0f3d3e", width=4)
    draw.rectangle((60, 60, 1020, 200), fill="#ffe08a", outline="#0f3d3e", width=3)
    draw.text((80, 90), title, fill="#0f3d3e", font=font_title)
    draw.text((80, 128), subtitle, fill="#1f2933", font=font_body)

    y = 240
    for line in lines[:16]:
        draw.text((90, y), f"• {line}", fill="#1f2933", font=font_body)
        y += 54

    # Mascote simples para clima divertido
    draw.ellipse((830, 1020, 980, 1170), fill="#ffffff", outline="#0f3d3e", width=4)
    draw.ellipse((870, 1060, 895, 1085), fill="#0f3d3e")
    draw.ellipse((915, 1060, 940, 1085), fill="#0f3d3e")
    draw.arc((875, 1090, 940, 1138), start=10, end=170, fill="#a9333a", width=4)

    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def app() -> None:
    apply_custom_css()
    ensure_assets_dir()

    if "api_base_url" not in st.session_state:
        st.session_state["api_base_url"] = default_api_base_url()
    if "timeout_seconds" not in st.session_state:
        st.session_state["timeout_seconds"] = 8

    st.markdown(
        """
        <div class="retro-hero">
          <h2 style="margin:0;">BOTao da Copa 2026</h2>
          <p class="retro-sub" style="margin:.3rem 0 0 0;">
            Seu painel oficial do bolao com clima retrô de Copa anos 90.
          </p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    with st.expander("Configuração avançada da API"):
        st.session_state["api_base_url"] = st.text_input("Base URL", value=st.session_state["api_base_url"]).rstrip("/")
        st.session_state["timeout_seconds"] = st.slider("Timeout (segundos)", 2, 30, st.session_state["timeout_seconds"])
        if st.button("Testar conexão", use_container_width=True):
            try:
                health = api_get(st.session_state["api_base_url"], st.session_state["timeout_seconds"], "/health")
                st.success(f"API online: {health.get('service', 'ok')}")
            except Exception as exc:  # noqa: BLE001
                st.error(f"Falha na conexão: {exc}")

    ranking_items, ranking_err = safe_fetch(st.session_state["api_base_url"], st.session_state["timeout_seconds"], "/ranking", "ranking")
    predictions_items, pred_err = safe_fetch(st.session_state["api_base_url"], st.session_state["timeout_seconds"], "/predictions", "predictions")
    results_items, results_err = safe_fetch(st.session_state["api_base_url"], st.session_state["timeout_seconds"], "/results", "results")
    games_items, games_err = safe_fetch(st.session_state["api_base_url"], st.session_state["timeout_seconds"], "/games", "games")

    if ranking_err or pred_err or results_err:
        st.error(
            "Erro ao carregar dados. "
            f"ranking={ranking_err or 'ok'} | palpites={pred_err or 'ok'} | resultados={results_err or 'ok'}"
        )
        return

    ranking_df = to_df(ranking_items)
    predictions_df = to_df(predictions_items)
    results_df = to_df(results_items)
    games_df = to_df(games_items)

    predictions_view = build_predictions_view(predictions_df, ranking_df, games_df)
    results_view = build_results_view(results_df, games_df)

    avatar_profiles = load_avatar_profiles()
    participant_names = sorted(predictions_view.get("participantName", pd.Series(dtype=str)).dropna().astype(str).unique().tolist())
    if not participant_names and not ranking_df.empty:
        participant_names = sorted(ranking_df.get("name", pd.Series(dtype=str)).dropna().astype(str).unique().tolist())
    if not participant_names:
        participant_names = ["Torcida"]

    if "selected_user" not in st.session_state:
        st.session_state["selected_user"] = participant_names[0]

    profile_col, avatar_col = st.columns([2, 1])
    with profile_col:
        selected_user = st.selectbox("Quem está consultando?", participant_names, index=participant_names.index(st.session_state["selected_user"]) if st.session_state["selected_user"] in participant_names else 0)
        st.session_state["selected_user"] = selected_user
    with avatar_col:
        avatars = ["⚽", "🧤", "🔥", "🦁", "🐯", "🐺", "🦅", "🐸", "🐙", "🎯"]
        current_avatar = avatar_profiles.get(selected_user, "⚽")
        picked = st.selectbox("Seu avatar", avatars, index=avatars.index(current_avatar) if current_avatar in avatars else 0)
        avatar_profiles[selected_user] = picked
        save_avatar_profiles(avatar_profiles)

    st.markdown(
        f"""
        <div class="retro-card" style="margin-bottom:1rem;">
          <strong>Perfil ativo:</strong> {avatar_profiles.get(selected_user, '⚽')} {selected_user}<br/>
          <span class="retro-sub">Use este avatar para aparecer no ranking e nos cards de compartilhamento.</span>
        </div>
        """,
        unsafe_allow_html=True,
    )

    total_participants = predictions_view["participantName"].nunique() if not predictions_view.empty else 0
    total_games = predictions_view["match"].nunique() if not predictions_view.empty else 0
    total_predictions = len(predictions_view)
    total_results = len(results_view)

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Participantes", total_participants)
    m2.metric("Jogos com palpite", total_games)
    m3.metric("Palpites registrados", total_predictions)
    m4.metric("Resultados confirmados", total_results)

    tab_predictions, tab_ranking, tab_results, tab_performance, tab_share = st.tabs(
        ["Palpites", "Ranking", "Resultados", "Desempenho", "Compartilhar"]
    )

    with tab_predictions:
        st.subheader("Palpites da galera")
        if predictions_view.empty:
            st.info("Nenhum palpite registrado ainda.")
        else:
            c1, c2, c3 = st.columns(3)
            with c1:
                participant_filter = st.selectbox(
                    "Filtrar por participante",
                    ["Todos"] + sorted(predictions_view["participantName"].unique().tolist()),
                )
            with c2:
                game_filter = st.selectbox(
                    "Filtrar por partida",
                    ["Todos"] + sorted(predictions_view["match"].unique().tolist()),
                )
            with c3:
                dates = sorted([d for d in predictions_view["gameDate"].dropna().astype(str).unique().tolist() if d != "-"])
                date_filter = st.selectbox("Filtrar por data", ["Todas"] + dates)

            filtered = predictions_view.copy()
            if participant_filter != "Todos":
                filtered = filtered[filtered["participantName"] == participant_filter]
            if game_filter != "Todos":
                filtered = filtered[filtered["match"] == game_filter]
            if date_filter != "Todas":
                filtered = filtered[filtered["gameDate"] == date_filter]

            st.caption(f"Total exibido: {len(filtered)}")
            st.dataframe(
                filtered[["participantName", "match", "gameDate", "palpite", "channel", "updatedAtFmt"]]
                .rename(
                    columns={
                        "participantName": "Participante",
                        "match": "Partida",
                        "gameDate": "Data do jogo",
                        "palpite": "Palpite",
                        "channel": "Canal",
                        "updatedAtFmt": "Atualizado em",
                    }
                ),
                use_container_width=True,
                hide_index=True,
            )

    with tab_ranking:
        st.subheader("Ranking oficial")
        if ranking_df.empty:
            st.info("Ranking ainda vazio.")
        else:
            rank = ranking_df.copy()
            rank["avatar"] = rank["name"].astype(str).map(lambda n: avatar_profiles.get(n, "⚽"))
            rank["display"] = rank.apply(
                lambda r: f"{r.get('avatar', '⚽')} {r.get('name', 'Participante')}", axis=1
            )

            podium = rank.sort_values(by="position").head(3)
            pcols = st.columns(3)
            for idx, (_, row) in enumerate(podium.iterrows()):
                pcols[idx].markdown(
                    f"""
                    <div class="retro-card">
                      <h4 style="margin:.1rem 0;">{row.get('position', '-')}º lugar</h4>
                      <div style="font-size:1.1rem;">{row.get('display', '')}</div>
                      <div class="retro-sub">{int(row.get('totalPoints', 0))} pontos</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

            st.dataframe(
                rank[["position", "display", "totalPoints"]].rename(
                    columns={
                        "position": "Posição",
                        "display": "Participante",
                        "totalPoints": "Pontos",
                    }
                ),
                use_container_width=True,
                hide_index=True,
            )

            if st.button("Atualizar ranking agora", use_container_width=True):
                try:
                    result = api_post(st.session_state["api_base_url"], st.session_state["timeout_seconds"], "/ranking/consolidate")
                    st.success(f"Ranking atualizado. Processados: {result.get('processed', 0)}")
                except Exception as exc:  # noqa: BLE001
                    st.error(f"Falha ao consolidar ranking: {exc}")

    with tab_results:
        st.subheader("Resultados confirmados")
        if results_view.empty:
            st.info("Sem resultados confirmados ainda.")
        else:
            st.dataframe(
                results_view[["match", "dataJogo", "placar", "reconciliationStatus", "updatedAt"]].rename(
                    columns={
                        "match": "Partida",
                        "dataJogo": "Data",
                        "placar": "Placar",
                        "reconciliationStatus": "Status",
                        "updatedAt": "Atualizado em (raw)",
                    }
                ),
                use_container_width=True,
                hide_index=True,
            )

    with tab_performance:
        st.subheader("Desempenho do participante")
        if predictions_view.empty:
            st.info("Sem dados de palpites para analisar desempenho.")
        else:
            mine = predictions_view[predictions_view["participantName"] == selected_user].copy()
            st.markdown(
                f"""
                <div class="retro-card">
                  <strong>{avatar_profiles.get(selected_user, '⚽')} {selected_user}</strong><br/>
                  <span class="retro-sub">Palpites feitos: {len(mine)}</span>
                </div>
                """,
                unsafe_allow_html=True,
            )
            if mine.empty:
                st.warning("Este participante ainda não possui palpites.")
            else:
                st.dataframe(
                    mine[["match", "gameDate", "palpite", "updatedAtFmt"]].rename(
                        columns={
                            "match": "Partida",
                            "gameDate": "Data",
                            "palpite": "Seu palpite",
                            "updatedAtFmt": "Atualizado",
                        }
                    ),
                    use_container_width=True,
                    hide_index=True,
                )

    with tab_share:
        st.subheader("Cards para compartilhar no grupo")
        st.caption("Tema retrô 90s para aumentar a zoeira e o engajamento no Zap.")

        rank_lines: list[str] = []
        if not ranking_df.empty:
            for _, row in ranking_df.sort_values(by="position").head(8).iterrows():
                avatar = avatar_profiles.get(str(row.get("name", "")), "⚽")
                rank_lines.append(f"{row.get('position', '-')}º {avatar} {row.get('name', 'Participante')} - {int(row.get('totalPoints', 0))} pts")

        ranking_card = make_retro_card(
            "Ranking do Bolão",
            f"Atualizado em {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            rank_lines or ["Ainda sem ranking consolidado."],
        )

        st.image(ranking_card, caption="Prévia do card de ranking")
        st.download_button(
            label="Baixar card de ranking (PNG)",
            data=ranking_card,
            file_name="ranking-botao-copa.png",
            mime="image/png",
            use_container_width=True,
        )

        perf_lines = []
        my_predictions = predictions_view[predictions_view["participantName"] == selected_user] if not predictions_view.empty else pd.DataFrame()
        for _, row in my_predictions.head(10).iterrows():
            perf_lines.append(f"{row.get('match', '')} | {row.get('palpite', '')}")

        perf_card = make_retro_card(
            "Meu Desempenho",
            f"{avatar_profiles.get(selected_user, '⚽')} {selected_user}",
            perf_lines or ["Sem palpites para este participante."],
        )
        st.image(perf_card, caption="Prévia do card de desempenho")
        st.download_button(
            label="Baixar card de desempenho (PNG)",
            data=perf_card,
            file_name=f"desempenho-{selected_user.lower().replace(' ', '-')}.png",
            mime="image/png",
            use_container_width=True,
        )


if __name__ == "__main__":
    app()
