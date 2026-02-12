def test_get_solver_config_default(client):
    """デフォルト設定を取得できる"""
    res = client.get("/api/solver-config")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == 1
    assert data["max_consecutive_days"] == 6
    assert data["enable_preferred_shift"] is True
    assert data["weight_preferred"] == 3.0


def test_update_solver_config(client):
    """設定を部分更新できる"""
    # まずデフォルトを作成
    client.get("/api/solver-config")

    res = client.put(
        "/api/solver-config",
        json={"max_consecutive_days": 4, "enable_fairness": False},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["max_consecutive_days"] == 4
    assert data["enable_fairness"] is False
    # 変更していないフィールドはデフォルトのまま
    assert data["enable_preferred_shift"] is True


def test_reset_solver_config(client):
    """設定をデフォルトにリセットできる"""
    # 変更
    client.get("/api/solver-config")
    client.put("/api/solver-config", json={"max_consecutive_days": 3})

    # リセット
    res = client.post("/api/solver-config/reset")
    assert res.status_code == 200
    data = res.json()
    assert data["max_consecutive_days"] == 6
