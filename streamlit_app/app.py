from __future__ import annotations

from datetime import datetime
from io import BytesIO
import base64
import os
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont
import pandas as pd
import requests
import streamlit as st
from streamlit.components.v1 import html
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

st.set_page_config(
    page_title="BOTao da Copa 2026",
    page_icon="/assets/icon.png",
    layout="wide",
    initial_sidebar_state="collapsed",
)

ASSETS_DIR = Path(__file__).resolve().parent / "assets"
AVATAR_DIR = ASSETS_DIR / "avatars"
DEFAULT_AVATAR = ASSETS_DIR / "avatar-default.png"
SUPABASE_PROFILE_TABLE = "participant_profiles"


def default_api_base_url() -> str:
    if "API_BASE_URL" in st.secrets:
        return str(st.secrets["API_BASE_URL"]).rstrip("/")
    return os.getenv("API_BASE_URL", "http://localhost:3000").rstrip("/")


def current_user_id() -> str:
    if "CURRENT_USER_ID" in st.secrets:
        return str(st.secrets["CURRENT_USER_ID"])
    return os.getenv("CURRENT_USER_ID", "1")


def current_user_name() -> str:
    if "CURRENT_USER_NAME" in st.secrets:
        return str(st.secrets["CURRENT_USER_NAME"])
    return os.getenv("CURRENT_USER_NAME", "Participante")


def env_value(key: str, default: str = "") -> str:
    if key in st.secrets:
        value = st.secrets[key]
        return str(value).strip()
    return os.getenv(key, default).strip()


def supabase_enabled() -> bool:
    return bool(env_value("SUPABASE_URL")) and bool(env_value("SUPABASE_SERVICE_ROLE_KEY"))


def supabase_bucket_name() -> str:
    return env_value("SUPABASE_BUCKET", "avatars")


@st.cache_resource(show_spinner=False)
def supabase_client(url: str, key: str) -> Client:
    return create_client(url, key)


def get_supabase_client() -> Client | None:
    if not supabase_enabled():
        return None
    return supabase_client(env_value("SUPABASE_URL"), env_value("SUPABASE_SERVICE_ROLE_KEY"))


def supabase_avatar_path(user_id: str) -> str:
    return f"participants/{user_id}/avatar.png"


def supabase_store_avatar(user_id: str, display_name: str, avatar_bytes: bytes, content_type: str) -> tuple[bool, str]:
    client = get_supabase_client()
    if client is None:
        return False, "Supabase indisponível"

    bucket = supabase_bucket_name()
    avatar_path = supabase_avatar_path(user_id)

    try:
        client.storage.from_(bucket).remove([avatar_path])
    except Exception:
        pass

    try:
        client.storage.from_(bucket).upload(
            avatar_path,
            avatar_bytes,
            file_options={"content-type": content_type},
        )
    except Exception as exc:  # noqa: BLE001
        return False, f"Falha ao enviar avatar ao Storage: {exc}"

    try:
        client.table(SUPABASE_PROFILE_TABLE).upsert(
            {
                "participant_id": user_id,
                "display_name": display_name,
                "avatar_path": avatar_path,
                "updated_at": datetime.now().isoformat(),
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        return False, f"Avatar enviado, mas falhou ao salvar perfil: {exc}"

    return True, avatar_path


def supabase_read_avatar(user_id: str) -> bytes | None:
    client = get_supabase_client()
    if client is None:
        return None

    try:
        response = client.table(SUPABASE_PROFILE_TABLE).select("avatar_path").eq("participant_id", user_id).limit(1).execute()
        rows = response.data or []
        if not rows:
            return None
        avatar_path = str(rows[0].get("avatar_path") or "").strip()
        if not avatar_path:
            return None
        blob = client.storage.from_(supabase_bucket_name()).download(avatar_path)
        return bytes(blob)
    except Exception:
        return None


def ensure_assets() -> None:
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    if not DEFAULT_AVATAR.exists():
        img = Image.new("RGB", (256, 256), "#f2f4f7")
        draw = ImageDraw.Draw(img)
        draw.ellipse((64, 30, 192, 158), fill="#c7d0db")
        draw.rounded_rectangle((45, 150, 211, 240), radius=28, fill="#c7d0db")
        img.save(DEFAULT_AVATAR, format="PNG")


def avatar_path_for_user(user_id: str) -> Path:
    return AVATAR_DIR / f"{user_id}.png"


def read_avatar(user_id: str) -> bytes:
    supabase_avatar = supabase_read_avatar(user_id)
    if supabase_avatar is not None:
        return supabase_avatar

    path = avatar_path_for_user(user_id)
    if path.exists():
        return path.read_bytes()
    return DEFAULT_AVATAR.read_bytes()


def save_avatar(user_id: str, uploaded: bytes) -> None:
    avatar_path_for_user(user_id).write_bytes(uploaded)


def apply_css() -> None:
    st.markdown(
        """
        <style>
        @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css');

        :root {
            --bg: #f6f7fb;
            --surface: #ffffff;
            --surface-2: #f2f4f8;
            --text: #16202a;
            --muted: #64758b;
            --brand: #2f6fed;
            --brand-soft: #eaf1ff;
            --ok: #14804a;
            --warn: #9a6700;
            --bad: #b42318;
            --line: #dde3ec;
        }

        .stApp {
            background: var(--bg);
            color: var(--text);
        }

        .block-container {
            padding-top: 1rem;
        }

        .top-header {
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 16px;
            box-shadow: 0 4px 14px rgba(17, 24, 39, 0.05);
            margin-bottom: 12px;
        }

        .top-title {
            margin: 0;
            font-size: 1.8rem;
            font-weight: 700;
            color: var(--text);
        }

        .top-subtitle {
            margin: 6px 0 0 0;
            color: var(--muted);
            font-size: .98rem;
        }

        .metric-card {
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 14px;
            padding: 12px 14px;
            min-height: 86px;
        }

        .metric-label {
            color: var(--muted);
            font-size: .85rem;
        }

        .metric-value {
            margin-top: 4px;
            font-size: 1.8rem;
            font-weight: 700;
            color: var(--text);
        }

        .status-tag {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border-radius: 999px;
            font-size: .8rem;
            font-weight: 600;
            padding: 4px 10px;
            border: 1px solid transparent;
            white-space: nowrap;
        }

        .status-exact { background: #ecfdf3; color: #116f3d; border-color: #bbf7d0; }
        .status-outcome { background: #eef4ff; color: #2446a8; border-color: #c8d8ff; }
        .status-miss { background: #fef1f2; color: #a3333d; border-color: #fecdd3; }
        .status-live { background: #fff7ed; color: #9a5413; border-color: #fed7aa; }

        .avatar-wrap {
            display: flex;
            align-items: center;
            gap: 10px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 14px;
            padding: 10px;
        }

        .podium {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
        }

        .podium-card {
            display: flex;
            align-items: center;
            gap: 12px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 14px;
            padding: 12px;
        }

        .result-card {
            background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 14px 14px 12px 14px;
            margin-bottom: 12px;
            box-shadow: 0 4px 14px rgba(17, 24, 39, 0.04);
        }

        .result-card-title {
            font-weight: 700;
            font-size: 1rem;
            color: var(--text);
            margin-bottom: 4px;
        }

        .result-card-subtitle {
            color: var(--muted);
            font-size: .88rem;
            margin-bottom: 10px;
        }

        .result-card-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
        }

        .table-chip {
            background: var(--surface-2);
            border: 1px solid var(--line);
            border-radius: 12px;
            padding: 10px 12px;
        }

        .table-chip-label {
            display: block;
            color: var(--muted);
            font-size: .74rem;
            text-transform: uppercase;
            letter-spacing: .06em;
            margin-bottom: 4px;
        }

        .table-chip-value {
            color: var(--text);
            font-weight: 600;
        }

        .table-chip-status {
            margin-top: 10px;
        }

        @media (max-width: 720px) {
            .result-card-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (min-width: 900px) {
            .podium {
                grid-template-columns: repeat(3, 1fr);
            }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def icon_title(icon: str, title: str, subtitle: str | None = None) -> None:
    subtitle_html = f'<p class="top-subtitle">{subtitle}</p>' if subtitle else ""
    st.markdown(
        f"""
        <div class="top-header">
            <h2 class="top-title"><i class="fa-solid {icon}"></i> {title}</h2>
            {subtitle_html}
        </div>
        """,
        unsafe_allow_html=True,
    )


def metric_html(label: str, value: Any) -> None:
    st.markdown(
        f"""
        <div class="metric-card">
          <div class="metric-label">{label}</div>
          <div class="metric-value">{value}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def fmt_dt(value: Any) -> str:
    if value is None or value == "":
        return "-"
    dt = pd.to_datetime(value, errors="coerce", utc=True)
    if pd.isna(dt):
        return "-"
    return dt.tz_convert("America/Sao_Paulo").strftime("%d/%m/%Y %H:%M")


def fmt_date(value: Any) -> str:
    if value is None or value == "":
        return "-"
    dt = pd.to_datetime(value, errors="coerce", utc=True)
    if pd.isna(dt):
        return "-"
    return dt.tz_convert("America/Sao_Paulo").strftime("%d/%m/%Y")


def api_get(base_url: str, timeout_seconds: int, path: str) -> dict[str, Any]:
    response = requests.get(f"{base_url}{path}", timeout=timeout_seconds)
    response.raise_for_status()
    return response.json()


def api_post(base_url: str, timeout_seconds: int, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    response = requests.post(f"{base_url}{path}", json=payload or {}, timeout=timeout_seconds)
    response.raise_for_status()
    return response.json()


def safe_fetch(base_url: str, timeout_seconds: int, path: str, fallback_key: str) -> tuple[list[dict[str, Any]], str | None]:
    try:
        data = api_get(base_url, timeout_seconds, path)
        return data.get(fallback_key, []), None
    except Exception as exc:  # noqa: BLE001
        return [], str(exc)


def to_df(items: list[dict[str, Any]]) -> pd.DataFrame:
    return pd.DataFrame(items) if items else pd.DataFrame()


def score_reason(pred_home: int, pred_away: int, real_home: int, real_away: int) -> str:
    if pred_home == real_home and pred_away == real_away:
        return "exact"
    pred_sign = (pred_home > pred_away) - (pred_home < pred_away)
    real_sign = (real_home > real_away) - (real_home < real_away)
    if pred_sign == real_sign:
        return "outcome"
    return "miss"


def reason_tag(reason: str) -> str:
    if reason == "exact":
        return '<span class="status-tag status-exact"><i class="fa-solid fa-bullseye"></i> Acertou</span>'
    if reason == "outcome":
        return '<span class="status-tag status-outcome"><i class="fa-solid fa-flag-checkered"></i> Acertou Vencedor</span>'
    if reason == "miss":
        return '<span class="status-tag status-miss"><i class="fa-solid fa-xmark"></i> Errou</span>'
    return '<span class="status-tag status-live"><i class="fa-solid fa-hourglass-half"></i> Em andamento</span>'


def game_status_tag(status: str | None) -> str:
    value = str(status or "").lower().strip()
    if value == "finished":
        return '<span class="status-tag status-exact"><i class="fa-solid fa-flag-checkered"></i> Finalizado</span>'
    if value == "in_progress":
        return '<span class="status-tag status-live"><i class="fa-solid fa-circle-play"></i> Em andamento</span>'
    return '<span class="status-tag status-outcome"><i class="fa-solid fa-calendar-day"></i> Agendado</span>'


def render_table_card(title: str, subtitle: str, columns: list[str], values: list[str], status_html: str | None = None) -> None:
    cols_html = "".join(
        f'<div class="table-chip"><span class="table-chip-label">{col}</span><div class="table-chip-value">{val}</div></div>'
        for col, val in zip(columns, values, strict=False)
    )
    status_block = f'<div class="table-chip-status">{status_html}</div>' if status_html else ""
    st.markdown(
        f"""
        <div class="result-card">
          <div class="result-card-title">{title}</div>
          <div class="result-card-subtitle">{subtitle}</div>
          <div class="result-card-grid">{cols_html}</div>
          {status_block}
        </div>
        """,
        unsafe_allow_html=True,
    )


def join_predictions_with_game_and_result(predictions_df: pd.DataFrame, games_df: pd.DataFrame, results_df: pd.DataFrame) -> pd.DataFrame:
    if predictions_df.empty:
        return predictions_df

    game_cols = ["id", "homeTeam", "awayTeam", "dateTime", "status"]
    game_use = games_df[game_cols].copy() if not games_df.empty else pd.DataFrame(columns=game_cols)
    game_use = game_use.rename(columns={"id": "gameId", "status": "gameStatus"})

    result_cols = ["gameId", "homeGoalsManual", "awayGoalsManual"]
    result_use = results_df[result_cols].copy() if not results_df.empty else pd.DataFrame(columns=result_cols)

    merged = predictions_df.merge(game_use, on="gameId", how="left").merge(result_use, on="gameId", how="left")

    merged["match"] = merged.apply(
        lambda r: f"{r.get('homeTeam', 'Time A')} x {r.get('awayTeam', 'Time B')}", axis=1
    )
    merged["gameDate"] = merged["dateTime"].apply(fmt_date)
    merged["gameDateTime"] = merged["dateTime"].apply(fmt_dt)
    merged["prediction"] = merged.apply(
        lambda r: f"{int(r.get('homeGoals', 0))} x {int(r.get('awayGoals', 0))}", axis=1
    )

    def status_of(row: pd.Series) -> str:
        gh = row.get("homeGoalsManual")
        ga = row.get("awayGoalsManual")
        if pd.isna(gh) or pd.isna(ga):
            return "live"
        return score_reason(int(row.get("homeGoals", 0)), int(row.get("awayGoals", 0)), int(gh), int(ga))

    merged["statusReason"] = merged.apply(status_of, axis=1)
    merged["statusTag"] = merged["statusReason"].apply(reason_tag)
    return merged


def participant_name_map(ranking_df: pd.DataFrame) -> dict[str, str]:
    if ranking_df.empty:
        return {}
    mapping: dict[str, str] = {}
    for _, row in ranking_df.iterrows():
        pid = str(row.get("participantId", "")).strip()
        if pid:
            mapping[pid] = str(row.get("name") or pid)
    return mapping


def chart_status_counts(df: pd.DataFrame) -> pd.DataFrame:
    labels = {
        "exact": "Acertou",
        "outcome": "Acertou Vencedor",
        "miss": "Errou",
        "live": "Em andamento",
    }
    status = df["statusReason"].value_counts().rename_axis("status").reset_index(name="qtd")
    status["status"] = status["status"].map(labels).fillna(status["status"])
    return status


def create_share_background(width: int = 1400, height: int = 1400) -> Image.Image:
    img = Image.new("RGB", (width, height), "#0c1730")
    draw = ImageDraw.Draw(img)

    # pitch-inspired grid and diagonal accents
    for x in range(0, width, 80):
        draw.line((x, 0, x, height), fill="#19335e", width=1)
    for y in range(0, height, 80):
        draw.line((0, y, width, y), fill="#19335e", width=1)
    for x in range(-200, width + 200, 180):
        draw.polygon([(x, 0), (x + 120, 0), (x + 40, 160), (x - 80, 160)], fill="#143055")

    draw.rounded_rectangle((40, 40, width - 40, height - 40), radius=28, fill="#111f3f", outline="#7cf0ff", width=4)
    draw.rounded_rectangle((70, 70, width - 70, 220), radius=18, fill="#f5d86b", outline="#ffffff", width=3)
    return img


def make_share_card(title: str, subtitle: str, lines: list[str], avatar: bytes | None = None) -> bytes:
    width, height = 1400, 1400
    img = create_share_background(width, height)
    draw = ImageDraw.Draw(img)
    f_title = ImageFont.load_default()
    f_text = ImageFont.load_default()

    draw.text((110, 104), title, fill="#0c1730", font=f_title)
    draw.text((110, 146), subtitle, fill="#1b2f59", font=f_text)

    # scoreboard band
    draw.rounded_rectangle((80, 260, width - 80, 540), radius=22, fill="#0f2a4d", outline="#7cf0ff", width=3)
    draw.text((110, 290), "Tabela em destaque", fill="#7cf0ff", font=f_text)

    y = 330
    for line in lines[:12]:
        draw.rounded_rectangle((110, y, width - 110, y + 58), radius=10, fill="#f9f4de", outline="#c9b45b", width=2)
        draw.text((132, y + 18), line, fill="#0c1730", font=f_text)
        y += 74

    # side trophy / crest and avatar circle
    draw.ellipse((1060, 620, 1290, 850), fill="#f5d86b", outline="#ffffff", width=4)
    draw.text((1130, 702), "🏆", fill="#0c1730", font=f_title)

    if avatar:
        try:
            av = Image.open(BytesIO(avatar)).convert("RGB").resize((140, 140))
            mask = Image.new("L", (140, 140), 0)
            ImageDraw.Draw(mask).ellipse((0, 0, 140, 140), fill=255)
            img.paste(av, (width - 230, height - 230), mask)
            draw.ellipse((width - 230, height - 230, width - 90, height - 90), outline="#7cf0ff", width=4)
        except Exception:
            pass

    output = BytesIO()
    img.save(output, format="PNG")
    return output.getvalue()


def render_status_cell(tag_html: str) -> None:
    html(f"<div>{tag_html}</div>", height=36)


def app() -> None:
    ensure_assets()
    apply_css()

    api_base_url = st.session_state.get("api_base_url", default_api_base_url())
    timeout_seconds = 8
    st.session_state["api_base_url"] = api_base_url

    user_id = current_user_id()
    user_name = current_user_name()
    avatar_bytes = read_avatar(user_id)

    icon_title("fa-trophy", "BOTao da Copa 2026", "Painel do participante")

    c_avatar, c_user = st.columns([1, 3])
    with c_avatar:
        st.image(avatar_bytes, width=88)
    with c_user:
        st.markdown(
            f"""
            <div class="avatar-wrap">
              <i class="fa-solid fa-circle-user"></i>
                            <div><strong>{user_name}</strong><br/><span style="color:#64758b;font-size:.9rem;">Participante identificado automaticamente</span></div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    upload = st.file_uploader(
        "Atualizar foto de perfil",
        type=["png", "jpg", "jpeg"],
        help="A imagem será usada no ranking, desempenho e cards compartilháveis.",
    )
    if upload is not None:
        uploaded_bytes = upload.getvalue()
        save_avatar(user_id, uploaded_bytes)
        ok, message = supabase_store_avatar(user_id, user_name, uploaded_bytes, upload.type or "image/png")
        if ok:
            st.success("Foto de perfil atualizada e sincronizada.")
        else:
            st.warning(f"Foto salva localmente, mas a sincronização não concluiu: {message}")
        avatar_bytes = read_avatar(user_id)

    ranking_items, ranking_err = safe_fetch(api_base_url, timeout_seconds, "/ranking", "ranking")
    predictions_items, pred_err = safe_fetch(api_base_url, timeout_seconds, "/predictions", "predictions")
    results_items, results_err = safe_fetch(api_base_url, timeout_seconds, "/results", "results")
    games_items, games_err = safe_fetch(api_base_url, timeout_seconds, "/games", "games")

    if ranking_err or pred_err or results_err or games_err:
        st.error(
            "Erro ao carregar dados: "
            f"ranking={ranking_err or 'ok'} | palpites={pred_err or 'ok'} | resultados={results_err or 'ok'} | jogos={games_err or 'ok'}"
        )
        return

    ranking_df = to_df(ranking_items)
    predictions_df = to_df(predictions_items)
    results_df = to_df(results_items)
    games_df = to_df(games_items)

    name_map = participant_name_map(ranking_df)
    predictions_view = join_predictions_with_game_and_result(predictions_df, games_df, results_df)
    if not predictions_view.empty:
        predictions_view["participantName"] = predictions_view["participantId"].astype(str).map(name_map).fillna(predictions_view["participantId"].astype(str))

    my_predictions = predictions_view[predictions_view["participantId"].astype(str) == str(user_id)].copy() if not predictions_view.empty else pd.DataFrame()

    m1, m2, m3, m4 = st.columns(4)
    with m1:
        metric_html("Participantes", ranking_df["participantId"].nunique() if not ranking_df.empty else 0)
    with m2:
        metric_html("Seus palpites", len(my_predictions))
    with m3:
        metric_html("Resultados confirmados", len(results_df))
    with m4:
        metric_html("Partidas disponíveis", len(games_df))

    tab_predictions, tab_ranking, tab_results, tab_performance, tab_share = st.tabs(
        ["Palpites", "Ranking", "Resultados", "Desempenho", "Compartilhar"]
    )

    with tab_predictions:
        icon_title("fa-pen-to-square", "Palpites", "Envio e consulta")

        if games_df.empty:
            st.warning("Nenhuma partida disponível para palpite.")
        else:
            # Inserção de palpite pelo usuário
            with st.form("insert_prediction", border=True):
                game_options = games_df.copy()
                game_options["label"] = game_options.apply(
                    lambda r: f"{r.get('homeTeam', 'A')} x {r.get('awayTeam', 'B')} — {fmt_dt(r.get('dateTime'))}", axis=1
                )
                selected = st.selectbox("Partida", game_options["label"].tolist())
                selected_row = game_options[game_options["label"] == selected].iloc[0]

                c1, c2 = st.columns(2)
                with c1:
                    home_g = st.number_input("Gols do mandante", min_value=0, max_value=20, value=1, step=1)
                with c2:
                    away_g = st.number_input("Gols do visitante", min_value=0, max_value=20, value=0, step=1)

                submit = st.form_submit_button("Salvar palpite", type="primary", use_container_width=True)
                if submit:
                    try:
                        resp = api_post(
                            api_base_url,
                            timeout_seconds,
                            "/predictions",
                            {
                                "participantId": user_id,
                                "gameId": str(selected_row.get("id")),
                                "homeGoals": int(home_g),
                                "awayGoals": int(away_g),
                            },
                        )
                        action = "atualizado" if resp.get("action") == "updated" else "registrado"
                        st.success(f"Palpite {action} com sucesso.")
                        st.rerun()
                    except Exception as exc:  # noqa: BLE001
                        st.error(f"Falha ao salvar palpite: {exc}")

        if my_predictions.empty:
            st.info("Você ainda não possui palpites registrados.")
        else:
            all_matches = sorted(my_predictions["match"].dropna().astype(str).unique().tolist())
            all_dates = sorted(my_predictions["gameDate"].dropna().astype(str).unique().tolist())

            fc1, fc2 = st.columns(2)
            with fc1:
                selected_matches = st.multiselect("Filtrar por partida", all_matches, default=[])
            with fc2:
                selected_dates = st.multiselect("Filtrar por data", all_dates, default=[])

            filtered = my_predictions.copy()
            if selected_matches:
                filtered = filtered[filtered["match"].isin(selected_matches)]
            if selected_dates:
                filtered = filtered[filtered["gameDate"].isin(selected_dates)]

            st.caption(f"Total exibido: {len(filtered)}")
            for _, row in filtered.sort_values(by=["gameDate", "match"]).iterrows():
                render_table_card(
                    title=f"{row['match']}",
                    subtitle=row.get("gameDateTime", row.get("gameDate", "")),
                    columns=["Palpite", "Atualizado"],
                    values=[str(row.get("prediction", "")), fmt_dt(row.get("updatedAt"))],
                    status_html=str(row.get("statusTag", "")),
                )

    with tab_ranking:
        icon_title("fa-ranking-star", "Ranking", "Classificação geral")
        if ranking_df.empty:
            st.info("Ranking ainda não disponível.")
        else:
            rank = ranking_df.sort_values(by="position").copy()
            top3 = rank.head(3)

            podium_cols = st.columns(3)
            for idx, (_, row) in enumerate(top3.iterrows()):
                pid = str(row.get("participantId", ""))
                pname = str(row.get("name") or pid)
                photo = read_avatar(pid)
                with podium_cols[idx]:
                    st.markdown(
                        f"""
                        <div class="podium-card">
                        <img src="data:image/png;base64,{base64.b64encode(photo).decode()}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid #7cf0ff;" />
                          <div>
                            <div style="font-weight:700;font-size:1.05rem;">{int(row.get('position', 0))}º {pname}</div>
                            <div style="color:#64758b;">{int(row.get('totalPoints', 0))} pontos</div>
                          </div>
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )

            show = rank[["position", "name", "totalPoints"]].rename(
                columns={"position": "Posição", "name": "Participante", "totalPoints": "Pontos"}
            )
            st.dataframe(show, use_container_width=True, hide_index=True)

    with tab_results:
        icon_title("fa-futbol", "Resultados", "Partidas confirmadas")
        if results_df.empty:
            st.info("Sem resultados confirmados.")
        else:
            results_use = results_df.copy()
            game_name = games_df[["id", "homeTeam", "awayTeam", "dateTime"]].rename(columns={"id": "gameId"}) if not games_df.empty else pd.DataFrame(columns=["gameId", "homeTeam", "awayTeam", "dateTime"])
            results_use = results_use.merge(game_name, on="gameId", how="left")
            results_use["Partida"] = results_use.apply(lambda r: f"{r.get('homeTeam', 'A')} x {r.get('awayTeam', 'B')}", axis=1)
            results_use["Data"] = results_use["dateTime"].apply(fmt_date)
            results_use["Placar"] = results_use.apply(lambda r: f"{int(r.get('homeGoalsManual', 0))} x {int(r.get('awayGoalsManual', 0))}", axis=1)

            my_result_status = None
            if not my_predictions.empty:
                result_map = my_predictions.groupby("gameId")["statusReason"].first().to_dict()
                results_use["Status do palpite"] = results_use["gameId"].map(
                    lambda gid: {
                        "exact": "Acertou",
                        "outcome": "Acertou vencedor",
                        "miss": "Errou",
                        "live": "Em andamento",
                    }.get(result_map.get(str(gid), "live"), "Em andamento")
                )
            else:
                results_use["Status do palpite"] = "Em andamento"

            st.dataframe(
                results_use[["Partida", "Data", "Placar", "Status do palpite", "reconciliationStatus"]],
                use_container_width=True,
                hide_index=True,
            )

    with tab_performance:
        icon_title("fa-chart-line", "Desempenho", "Indicadores do seu histórico")
        if my_predictions.empty:
            st.info("Sem dados suficientes para desempenho.")
        else:
            status_count = chart_status_counts(my_predictions)
            c1, c2 = st.columns(2)
            with c1:
                st.bar_chart(status_count.set_index("status"))
            with c2:
                by_date = my_predictions.groupby("gameDate", dropna=False).size().reset_index(name="Palpites")
                st.line_chart(by_date.set_index("gameDate"))

            exact = int((my_predictions["statusReason"] == "exact").sum())
            outcome = int((my_predictions["statusReason"] == "outcome").sum())
            miss = int((my_predictions["statusReason"] == "miss").sum())
            live = int((my_predictions["statusReason"] == "live").sum())
            total_done = max(exact + outcome + miss, 1)
            accuracy = round(((exact + outcome) / total_done) * 100, 1)

            s1, s2, s3, s4, s5 = st.columns(5)
            with s1:
                metric_html("Acertou", exact)
            with s2:
                metric_html("Acertou Vencedor", outcome)
            with s3:
                metric_html("Errou", miss)
            with s4:
                metric_html("Em andamento", live)
            with s5:
                metric_html("Taxa de acerto", f"{accuracy}%")

    with tab_share:
        icon_title("fa-share-nodes", "Compartilhar", "Cards prontos para enviar")

        rank_lines = []
        if not ranking_df.empty:
            for _, row in ranking_df.sort_values(by="position").head(10).iterrows():
                rank_lines.append(f"{int(row.get('position', 0))}º  {row.get('name', '')} — {int(row.get('totalPoints', 0))} pts")

        rank_card = make_share_card(
            "Ranking do Bolão",
            datetime.now().strftime("Atualizado em %d/%m/%Y %H:%M"),
            rank_lines or ["Ranking sem dados"],
            avatar_bytes,
        )

        st.image(rank_card, use_container_width=True)
        st.download_button(
            "Baixar card do ranking",
            data=rank_card,
            file_name="ranking-bolao.png",
            mime="image/png",
            use_container_width=True,
        )

        perf_lines = []
        if not my_predictions.empty:
            for _, row in my_predictions.head(12).iterrows():
                perf_lines.append(f"{row.get('match', '')} · {row.get('prediction', '')} · {str(row.get('statusReason', 'live')).upper()}")

        rodada_lines = []
        if not my_predictions.empty:
            rodada_lines = [
                f"{row.get('match', '')} | {row.get('prediction', '')}"
                for _, row in my_predictions.sort_values(by=["gameDate", "match"]).head(8).iterrows()
            ]

        perf_card = make_share_card(
            "Desempenho",
            f"{user_name} — {datetime.now().strftime('%d/%m/%Y')}",
            perf_lines or ["Sem palpites"],
            avatar_bytes,
        )
        st.image(perf_card, use_container_width=True)
        st.download_button(
            "Baixar card de desempenho",
            data=perf_card,
            file_name="desempenho-bolao.png",
            mime="image/png",
            use_container_width=True,
        )

        rodada_card = make_share_card(
            "Palpites da Rodada",
            datetime.now().strftime("%d/%m/%Y"),
            rodada_lines or ["Sem palpites para exibir"],
            avatar_bytes,
        )
        st.image(rodada_card, use_container_width=True)
        st.download_button(
            "Baixar card da rodada",
            data=rodada_card,
            file_name="palpites-rodada.png",
            mime="image/png",
            use_container_width=True,
        )


if __name__ == "__main__":
    app()
