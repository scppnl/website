import base64, json, os
import functions_framework
from google.cloud import billing_v1

PROJECT_NAME = f"projects/{os.environ['PROJECT_ID']}"
client = billing_v1.CloudBillingClient()

@functions_framework.cloud_event
def stop_billing(cloud_event):
    data = json.loads(base64.b64decode(cloud_event.data["message"]["data"]))
    cost, budget = data["costAmount"], data["budgetAmount"]
    if cost < budget:
        print(f"Cost {cost} < budget {budget}; nothing to do.")
        return

    info = client.get_project_billing_info(name=PROJECT_NAME)
    if not info.billing_enabled:
        print("Billing already disabled.")
        return

    client.update_project_billing_info(
        name=PROJECT_NAME,
        project_billing_info=billing_v1.ProjectBillingInfo(billing_account_name=""),
    )
    print(f"Billing disabled for {PROJECT_NAME}: cost {cost} >= budget {budget}.")
