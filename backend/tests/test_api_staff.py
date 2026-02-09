def test_create_staff(client):
    response = client.post(
        "/api/staff",
        json={"name": "田中太郎", "role": "リーダー", "max_days_per_week": 5},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "田中太郎"
    assert data["id"] is not None


def test_list_staff(client):
    client.post("/api/staff", json={"name": "田中", "role": "一般"})
    client.post("/api/staff", json={"name": "佐藤", "role": "一般"})
    response = client.get("/api/staff")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_staff(client):
    res = client.post("/api/staff", json={"name": "田中", "role": "一般"})
    staff_id = res.json()["id"]
    response = client.put(f"/api/staff/{staff_id}", json={"role": "リーダー"})
    assert response.status_code == 200
    assert response.json()["role"] == "リーダー"


def test_delete_staff(client):
    res = client.post("/api/staff", json={"name": "田中", "role": "一般"})
    staff_id = res.json()["id"]
    response = client.delete(f"/api/staff/{staff_id}")
    assert response.status_code == 204
    assert client.get("/api/staff").json() == []
