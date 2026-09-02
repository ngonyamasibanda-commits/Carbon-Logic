"""Enterprise-grade data visualizations with Plotly."""

import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
import pandas as pd


def emissions_by_category_donut(df: pd.DataFrame) -> go.Figure:
    """Create a professional donut chart for emissions by category."""
    if df.empty:
        return go.Figure()
    
    by_cat = df.groupby("Category")["Emissions (tCO2e)"].sum().reset_index()
    
    fig = go.Figure(data=[go.Pie(
        labels=by_cat["Category"],
        values=by_cat["Emissions (tCO2e)"],
        hole=0.5,
        marker=dict(
            colors=["#64748B", "#475569", "#10B981", "#059669", "#047857", "#065F46"],
            line=dict(color="#333", width=1)
        ),
        textinfo="label+percent",
        textposition="outside",
        textfont=dict(size=12, color="#FAFAFA"),
    )])
    
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#FAFAFA", size=14),
        showlegend=True,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="center",
            x=0.5,
            font=dict(color="#FAFAFA")
        ),
        margin=dict(t=20, b=20, l=20, r=20),
    )
    
    return fig


def emissions_by_scope_bar(df: pd.DataFrame) -> go.Figure:
    """Create a professional bar chart for emissions by scope."""
    if df.empty:
        return go.Figure()
    
    if "Scope" not in df.columns:
        return go.Figure()
    
    by_scope = df.groupby("Scope")["Emissions (tCO2e)"].sum().reset_index()
    
    fig = go.Figure(data=[go.Bar(
        x=by_scope["Scope"],
        y=by_scope["Emissions (tCO2e)"],
        marker=dict(
            color=["#64748B", "#10B981", "#475569"],
            line=dict(color="#333", width=1)
        ),
        text=by_scope["Emissions (tCO2e)"].round(3),
        textposition="outside",
        textfont=dict(color="#FAFAFA"),
    )])
    
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#FAFAFA", size=14),
        xaxis=dict(
            gridcolor="#333",
            tickfont=dict(color="#9CA3AF"),
        ),
        yaxis=dict(
            gridcolor="#333",
            tickfont=dict(color="#9CA3AF"),
            title="Emissions (tCO2e)",
            titlefont=dict(color="#9CA3AF"),
        ),
        margin=dict(t=20, b=20, l=20, r=20),
    )
    
    return fig


def monthly_emissions_ledger(df: pd.DataFrame) -> go.Figure:
    """Create a sophisticated time-series bar chart for monthly emissions."""
    if df.empty:
        return go.Figure()
    
    if "Date Added" not in df.columns:
        return go.Figure()
    
    df["Date Added"] = pd.to_datetime(df["Date Added"], errors="coerce")
    df["Month"] = df["Date Added"].dt.to_period("M")
    
    monthly = df.groupby("Month")["Emissions (tCO2e)"].sum().reset_index()
    monthly["Month"] = monthly["Month"].astype(str)
    
    fig = go.Figure(data=[go.Bar(
        x=monthly["Month"],
        y=monthly["Emissions (tCO2e)"],
        marker=dict(
            color="#64748B",
            line=dict(color="#333", width=1)
        ),
        text=monthly["Emissions (tCO2e)"].round(3),
        textposition="outside",
        textfont=dict(color="#FAFAFA"),
    )])
    
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#FAFAFA", size=14),
        xaxis=dict(
            gridcolor="#333",
            tickfont=dict(color="#9CA3AF"),
            title="Month",
            titlefont=dict(color="#9CA3AF"),
        ),
        yaxis=dict(
            gridcolor="#333",
            tickfont=dict(color="#9CA3AF"),
            title="Emissions (tCO2e)",
            titlefont=dict(color="#9CA3AF"),
        ),
        margin=dict(t=20, b=20, l=20, r=20),
    )
    
    return fig


def emissions_trend_line(df: pd.DataFrame) -> go.Figure:
    """Create a line chart showing emissions trend over time."""
    if df.empty:
        return go.Figure()
    
    if "Date Added" not in df.columns:
        return go.Figure()
    
    df["Date Added"] = pd.to_datetime(df["Date Added"], errors="coerce")
    df = df.sort_values("Date Added")
    df["Cumulative"] = df["Emissions (tCO2e)"].cumsum()
    
    fig = go.Figure(data=[go.Scatter(
        x=df["Date Added"],
        y=df["Cumulative"],
        mode="lines+markers",
        line=dict(color="#10B981", width=2),
        marker=dict(color="#10B981", size=6),
    )])
    
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#FAFAFA", size=14),
        xaxis=dict(
            gridcolor="#333",
            tickfont=dict(color="#9CA3AF"),
            title="Date",
            titlefont=dict(color="#9CA3AF"),
        ),
        yaxis=dict(
            gridcolor="#333",
            tickfont=dict(color="#9CA3AF"),
            title="Cumulative Emissions (tCO2e)",
            titlefont=dict(color="#9CA3AF"),
        ),
        margin=dict(t=20, b=20, l=20, r=20),
    )
    
    return fig
