CANONICAL_SCHEMAS = {
    "projects": {
        "_unique_fields": ["project_name"], # Logic: Project Name must be unique
        "project_name": None,
        "project_description": None,
        "start_date": None,
        "end_date": None,
        "status": None,
        "client_name": None,
        "organization_id": None,
        "leader_email": None,
        "leader_of_project": None,
        "project_field": None,
        "team_members": [],
        "tech_stack": [],
        "project_scope": None,
        "project_responsibility": None,
        "custom_questions": None,
        "custom_answers": None,
        "id": None,
        "custom_uuid": None,
        "assigned_to_emails": [],   #krishi
        "role_answers": None,
        "assigned_role": None,
        "upload_documents": None,
    },

    "employees": {
        "_unique_fields": ["email", "role"], # Logic: Combination of Email + Role must be unique
        "name": None,
        "email": None,
        "role": None,
        "department": None,
        "skills": [],
        "status": None,
    },

    "announcements": {
        # No unique check for announcements typically, or maybe sender + timestamp?
        "sender_email": None,
        "recipient_email": None,
        "message": None,
        "timestamp": None,
        "status": None,
        "user_id": None,
    },

    # ➕ Future tables go here ONLY
}
