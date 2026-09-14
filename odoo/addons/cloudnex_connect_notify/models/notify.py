import json
import logging
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen

from odoo import api, models

_logger = logging.getLogger(__name__)


class CloudnexConnectNotify(models.AbstractModel):
    _name = "cloudnex.connect.notify"
    _description = "POST LINE ops hook for Cloudnex Connect"

    @api.model
    def post_event(self, event, order_id):
        if not order_id:
            return False
        ICP = self.env["ir.config_parameter"].sudo()
        base = (ICP.get_param("cloudnex.public_base_url") or "").rstrip("/")
        token = ICP.get_param("cloudnex.ops_token") or ""
        if not base or not token:
            _logger.warning("cloudnex.notify skipped: set cloudnex.public_base_url and cloudnex.ops_token")
            return False
        body = json.dumps({"event": event, "orderId": int(order_id)}).encode()
        req = Request(
            f"{base}/ops/odoo-hook",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
            },
            method="POST",
        )
        try:
            with urlopen(req, timeout=15) as resp:
                resp.read()
            return True
        except (URLError, HTTPError, TimeoutError, ValueError) as err:
            _logger.warning("cloudnex.notify failed: %s", err)
            return False
