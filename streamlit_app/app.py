from __future__ import annotations

from datetime import datetime
import os
from typing import Any

import pandas as pd
import requests
import streamlit as st

st.set_page_config(page_title="BOTao da Copa - Painel", page_icon="⚽", layout="wide")


def default_api_base_url() -> str:
    # Priority: Streamlit secrets > environment variable > localhost fallback.
    if "API_BASE_URL" in st.secrets:
        return str(st.secrets["API_BASE_URL"]).rstrip("/")
    return os.getenv("API_BASE_URL", "http://localhost:3000").rstrip("/")

st.title("BOTao da Copa - Painel Operacional")
st.caption("MVP de operacao: ranking, palpites, resultados e resumo")

with st.sidebar:
    st.header("Conexao API")
    default_url = st.session_state.get("api_base_url", default_api_base_url())
    api_base_url = st.text_input("Base URL", value=default_url).rstrip("/")
    st.session_state["api_base_url"] = api_base_url
    timeout_seconds = st.slider("Timeout (segundos)", min_value=2, max_value=30, value=8)

    st.caption("Dica deploy: configure API_BASE_URL em Secrets no Streamlit Cloud.")

    if st.button("Testar conexao", use_container_width=True):
        try:
            health = requests.get(f"{api_base_url}/health", timeout=timeout_seconds)
            health.raise_for_status()
            st.success("API conectada com sucesso.")
        except Exception as exc:  # noqa: BLE001
            st.error(f"Falha na conexao: {exc}")


def api_get(path: str) -> dict[str, Any]:
    url = f"{api_base_url}{path}"
    resp = requests.get(url, timeout=timeout_seconds)
    resp.raise_for_status()
    return resp.json()


def api_post(path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"{api_base_url}{path}"
    resp = requests.post(url, json=payload or {}, timeout=timeout_seconds)
    resp.raise_for_status()
    return resp.json()


def to_df(items: list[dict[str, Any]]) -> pd.DataFrame:
    if not items:
        return pd.DataFrame()
    return pd.DataFrame(items)


def safe_fetch(path: str, fallback_key: str) -> tuple[list[dict[str, Any]], str | None]:
    try:
        data = api_get(path)
        return data.get(fallback_key, []), None
    except Exception as exc:  # noqa: BLE001
        return [], str(exc)


tab_ranking, tab_predictions, tab_results, tab_round_summary = st.tabs(
    ["Ranking", "Palpites", "Resultados", "Resumo da Rodada"]
)

with tab_ranking:
    st.subheader("Ranking")
    col_a, col_b = st.columns([1, 1])
    with col_a:
        refresh_ranking = st.button("Atualizar ranking", use_container_width=True)
    with col_b:
        if st.button("Consolidar ranking agora", type="primary", use_container_width=True):
            try:
                result = api_post("/ranking/consolidate")
                st.success(
                    f"Consolidacao concluida. Resultados processados: {result.get('processed', 0)}"
                )
            except Exception as exc:  # noqa: BLE001
                st.error(f"Falha ao consolidar: {exc}")

    if refresh_ranking or True:
        ranking_items, err = safe_fetch("/ranking", "ranking")
        if err:
            st.error(f"Erro ao buscar ranking: {err}")
        else:
            ranking_df = to_df(ranking_items)
            if ranking_df.empty:
                st.info("Ranking vazio no momento.")
            else:
                st.dataframe(ranking_df, use_container_width=True, hide_index=True)

with tab_predictions:
    st.subheader("Palpites")
    predictions_items, err = safe_fetch("/predictions", "predictions")
    if err:
        st.error(f"Erro ao buscar palpites: {err}")
    else:
        predictions_df = to_df(predictions_items)
        if predictions_df.empty:
            st.info("Nenhum palpite registrado.")
        else:
            left, right = st.columns(2)
            with left:
                participants = ["Todos"] + sorted(
                    predictions_df["participantId"].dropna().astype(str).unique().tolist()
                )
                selected_participant = st.selectbox("Filtrar por participante", participants)
            with right:
                games = ["Todos"] + sorted(
                    predictions_df["gameId"].dropna().astype(str).unique().tolist()
                )
                selected_game = st.selectbox("Filtrar por jogo", games)

            filtered_df = predictions_df.copy()
            if selected_participant != "Todos":
                filtered_df = filtered_df[filtered_df["participantId"].astype(str) == selected_participant]
            if selected_game != "Todos":
                filtered_df = filtered_df[filtered_df["gameId"].astype(str) == selected_game]

            st.caption(f"Total exibido: {len(filtered_df)}")
            st.dataframe(filtered_df, use_container_width=True, hide_index=True)

with tab_results:
    st.subheader("Resultados")
    top_left, top_right = st.columns([2, 1])

    with top_left:
        results_items, err = safe_fetch("/results", "results")
        if err:
            st.error(f"Erro ao buscar resultados: {err}")
        else:
            results_df = to_df(results_items)
            if results_df.empty:
                st.info("Nenhum resultado confirmado ainda.")
            else:
                st.dataframe(results_df, use_container_width=True, hide_index=True)

    with top_right:
        st.markdown("### Lancar/Atualizar resultado")
        with st.form("result_form", border=True):
            game_id = st.text_input("id_jogo", placeholder="ex: BRA-ARG")
            home_goals = st.number_input("gols_casa_manual", min_value=0, max_value=20, value=1, step=1)
            away_goals = st.number_input("gols_fora_manual", min_value=0, max_value=20, value=0, step=1)
            reconciliation = st.selectbox(
                "status_reconciliacao",
                ["confirmed", "pending", "conflict"],
                index=0,
            )
            submitted = st.form_submit_button("Salvar resultado", type="primary")
            if submitted:
                if not game_id.strip():
                    st.warning("Informe id_jogo antes de salvar.")
                else:
                    payload = {
                        "gameId": game_id.strip().upper(),
                        "homeGoalsManual": int(home_goals),
                        "awayGoalsManual": int(away_goals),
                        "reconciliationStatus": reconciliation,
                    }
                    try:
                        api_post("/results", payload)
                        st.success("Resultado salvo com sucesso.")
                    except Exception as exc:  # noqa: BLE001
                        st.error(f"Falha ao salvar resultado: {exc}")

with tab_round_summary:
    st.subheader("Resumo da Rodada")
    summary_col, actions_col = st.columns([3, 1])

    ranking_items, ranking_err = safe_fetch("/ranking", "ranking")
    predictions_items, pred_err = safe_fetch("/predictions", "predictions")
    results_items, results_err = safe_fetch("/results", "results")

    if ranking_err or pred_err or results_err:
        st.error(
            "Erro ao montar resumo. "
            f"ranking={ranking_err or 'ok'} | palpites={pred_err or 'ok'} | resultados={results_err or 'ok'}"
        )
    else:
        ranking_df = to_df(ranking_items)
        predictions_df = to_df(predictions_items)
        results_df = to_df(results_items)

        now_text = datetime.now().strftime("%d/%m/%Y %H:%M")
        top_lines: list[str] = []
        if not ranking_df.empty:
            for _, row in ranking_df.head(5).iterrows():
                pos = row.get("position", "-")
                name = row.get("name") or row.get("participantId", "participante")
                points = row.get("totalPoints", 0)
                top_lines.append(f"{pos}. {name} - {points} pts")

        games_with_predictions = (
            predictions_df["gameId"].nunique() if not predictions_df.empty and "gameId" in predictions_df.columns else 0
        )
        participants_with_predictions = (
            predictions_df["participantId"].nunique()
            if not predictions_df.empty and "participantId" in predictions_df.columns
            else 0
        )

        summary_text = "\n".join(
            [
                f"Resumo da rodada - {now_text}",
                "",
                f"Palpites recebidos: {len(predictions_df)}",
                f"Participantes ativos: {participants_with_predictions}",
                f"Jogos com palpites: {games_with_predictions}",
                f"Resultados confirmados: {len(results_df)}",
                "",
                "Top ranking:",
                *(top_lines or ["Ranking ainda sem dados."]),
            ]
        )

        with summary_col:
            st.text_area("Texto pronto para compartilhar no grupo", value=summary_text, height=320)

        with actions_col:
            st.markdown("### Acoes")
            if st.button("Consolidar ranking", use_container_width=True):
                try:
                    api_post("/ranking/consolidate")
                    st.success("Consolidacao disparada.")
                except Exception as exc:  # noqa: BLE001
                    st.error(f"Falha: {exc}")
            st.info(
                "Fluxo recomendado:\n"
                "1. Salvar resultados\n"
                "2. Consolidar ranking\n"
                "3. Copiar resumo e publicar"
            )
