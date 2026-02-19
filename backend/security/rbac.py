def apply_rbac(query, table: str, role: str, user_email: str):

    role = (role or "employee").strip().lower()
    table = (table or "").strip().lower()

    if role == "admin":
        return query

    if role == "manager":
        if table == "projects":
            return query.contains("leader_of_project", [user_email])
        if table == "employee_login":
            return query.eq("email", user_email)
        return query

    if role == "project_manager":
        if table == "projects":
            return query.contains("leader_of_project", [user_email])
        return query

    if table == "projects":
        return query.contains("assigned_to_emails", [user_email])

    if table == "employee_login":
        return query.eq("email", user_email)

    return query